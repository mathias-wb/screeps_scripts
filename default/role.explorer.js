// Explorer role module
const config = require('config');
const creepHelper = require('creep.helper');

module.exports = {
    /**
     * Run explorer behavior
     * @param {Creep} creep - The explorer creep
     */
    run: function(creep) {
        // If no mode is set, set to exploring
        if (!creep.memory.mode || creep.memory.mode === config.MODE.idle) {
            creep.memory.mode = config.MODE.exploring;
            creep.memory.currentGoal = "findHighway"; // Goals: findHighway, followHighway, harvestDeposit, returnHome
            creep.memory.homeRoom = creep.room.name;
        }
        
        // If creep is full, switch to storing mode
        if (creep.store.getFreeCapacity() === 0 && creep.memory.mode === config.MODE.exploring) {
            creep.memory.mode = config.MODE.storing;
            return;
        }
        
        // If creep is empty and storing, return to exploring or suicide
        if (creep.store.getUsedCapacity() === 0 && creep.memory.mode === config.MODE.storing) {
            // If we had already found a deposit, suicide after delivering
            if (creep.memory.foundDeposit) {
                creep.suicide();
                return;
            }
            
            // Otherwise, go back to exploring
            creep.memory.mode = config.MODE.exploring;
            return;
        }
        
        switch (creep.memory.mode) {
            case config.MODE.exploring:
                this.exploreAndHarvest(creep);
                break;
            case config.MODE.storing:
                this.storeResources(creep);
                break;
        }
    },
    
    /**
     * Explore rooms and harvest deposits
     * @param {Creep} creep - The explorer creep
     */
    exploreAndHarvest: function(creep) {
        creepHelper.say(creep);
        
        if (creep.memory.currentGoal === "findHighway") {
            const coords = this.parseRoomName(creep.room.name);
            
            // Find closest highway (where one coordinate is 0)
            if (this.isHighwayRoom(creep.room.name)) {
                creep.memory.currentGoal = "followHighway";
                creep.memory.direction = Math.random() < 0.5 ? "horizontal" : "vertical";
                return;
            }
            
            // Determine direction to nearest highway
            let targetRoom;
            if (coords.x % 10 < coords.y % 10) {
                // Get to a room where X is divisible by 10
                const targetX = Math.floor(coords.x / 10) * 10;
                targetRoom = `${coords.xDir}${targetX}${coords.yDir}${coords.y}`;
            } else {
                // Get to a room where Y is divisible by 10
                const targetY = Math.floor(coords.y / 10) * 10;
                targetRoom = `${coords.xDir}${coords.x}${coords.yDir}${targetY}`;
            }
            
            this.travelToRoom(creep, targetRoom);
        }
        
        else if (creep.memory.currentGoal === "followHighway") {
            // First check for deposits in current room
            // In actual game use FIND_DEPOSITS, for simulation use FIND_MINERALS
            const deposits = creep.room.find(FIND_MINERALS);
            
            if (deposits.length > 0) {
                creep.memory.currentGoal = "harvestDeposit";
                creep.memory.depositId = deposits[0].id;
                return;
            }
            
            // Continue along highway
            const coords = this.parseRoomName(creep.room.name);
            let nextRoom;
            
            if (creep.memory.direction === "horizontal") {
                // Move along X axis (East or West)
                const nextX = coords.x + (coords.xDir === 'E' ? 1 : -1);
                nextRoom = `${coords.xDir}${nextX}${coords.yDir}${coords.y}`;
            } else {
                // Move along Y axis (North or South)
                const nextY = coords.y + (coords.yDir === 'N' ? 1 : -1);
                nextRoom = `${coords.xDir}${coords.x}${coords.yDir}${nextY}`;
            }
            
            this.travelToRoom(creep, nextRoom);
        }
        
        else if (creep.memory.currentGoal === "harvestDeposit") {
            const deposit = Game.getObjectById(creep.memory.depositId);
            
            // If deposit exists and has minerals left
            if (deposit) {
                // When using FIND_MINERALS for testing, check if there are minerals left
                if (deposit.mineralAmount > 0) {
                    // For real deposits, check cooldown
                    // if (deposit.cooldown === 0) {
                    if (creep.harvest(deposit) === ERR_NOT_IN_RANGE) {
                        creepHelper.moveTo(creep, deposit);
                    }
                    creep.memory.foundDeposit = true;
                } else {
                    // Source is depleted, go back home
                    creep.memory.mode = config.MODE.storing;
                }
            } else {
                // Invalid deposit ID, resume exploration
                delete creep.memory.depositId;
                creep.memory.currentGoal = "findHighway";
            }
        }
    },
    
    /**
     * Parse room name into coordinates and directions
     * @param {string} roomName - The room name (e.g. "E15N10")
     * @returns {Object} Parsed room coordinates
     */
    parseRoomName: function(roomName) {
        const match = roomName.match(/([EW])(\d+)([NS])(\d+)/);
        return {
            xDir: match[1],
            x: parseInt(match[2]),
            yDir: match[3],
            y: parseInt(match[4])
        };
    },
    
    /**
     * Check if a room is on a highway (has a coordinate divisible by 10)
     * @param {string} roomName - The room name to check
     * @returns {boolean} True if the room is on a highway
     */
    isHighwayRoom: function(roomName) {
        const coords = this.parseRoomName(roomName);
        return coords.x % 10 === 0 || coords.y % 10 === 0;
    },
    
    /**
     * Travel to a specific room
     * @param {Creep} creep - The creep to move
     * @param {string} roomName - The target room name
     */
    travelToRoom: function(creep, roomName) {
        // If already in target room, return true
        if (creep.room.name === roomName) {
            return true;
        }
        
        // Find exit to target room
        const exitDir = Game.map.findExit(creep.room, roomName);
        if (exitDir === ERR_NO_PATH) {
            // No path to room, try a different one
            creep.memory.currentGoal = "findHighway";
            return false;
        }
        
        const exit = creep.pos.findClosestByPath(exitDir);
        if (!exit) {
            // No viable exit, try a different approach
            creep.memory.currentGoal = "findHighway";
            return false;
        }
        
        // Move to exit
        creepHelper.moveTo(creep, exit);
        return false;
    },
    
    /**
     * Return to base and store collected resources
     * @param {Creep} creep - The explorer creep
     */
    storeResources: function(creep) {
        creepHelper.say(creep);
        
        // Set target room to home if not set
        if (!creep.memory.homeRoom) {
            creep.memory.homeRoom = config.ROOM_NAME;
        }
        
        // If not in home room, travel back
        if (creep.room.name !== creep.memory.homeRoom) {
            this.travelToRoom(creep, creep.memory.homeRoom);
            return;
        }
        
        // In home room, find storage
        const storage = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_STORAGE || 
                     s.structureType === STRUCTURE_CONTAINER
        })[0];
        
        if (storage) {
            // Transfer all resources in inventory
            for (const resourceType in creep.store) {
                if (creep.transfer(storage, resourceType) === ERR_NOT_IN_RANGE) {
                    creepHelper.moveTo(creep, storage);
                    return;
                }
            }
        } else {
            // No storage available, drop resources
            for (const resourceType in creep.store) {
                creep.drop(resourceType);
            }
        }
    }
};