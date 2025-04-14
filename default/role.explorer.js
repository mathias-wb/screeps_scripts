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
            // Initialize room tracking
            creep.memory.visitedRooms = creep.memory.visitedRooms || {};
            creep.memory.currentGoal = "findDeposit"; // Goals: findDeposit, harvestDeposit, returnHome
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
        
        // Switch to storing mode if full
        if (creep.store.getFreeCapacity() === 0) {
            creep.memory.mode = config.MODE.storing;
            creep.memory.currentGoal = "returnHome";
            creep.memory.targetRoom = config.ROOM_NAME;
            return;
        }
        
        // Track current room as visited
        creep.memory.visitedRooms = creep.memory.visitedRooms || {};
        creep.memory.visitedRooms[creep.room.name] = (creep.memory.visitedRooms[creep.room.name] || 0) + 1;
        
        // Handling based on current goal
        if (creep.memory.currentGoal === "findDeposit") {
            // Check for deposits in current room
            const deposits = creep.room.find(FIND_DEPOSITS, {
                filter: (d) => d.cooldown === 0
            });
            
            if (deposits.length > 0) {
                // Found deposits, switch to harvesting them
                creep.memory.currentGoal = "harvestDeposit";
                creep.memory.depositId = deposits[0].id;
            } else {
                // No deposits, find a new room to explore
                this.selectNewTargetRoom(creep);
            }
        }
        
        if (creep.memory.currentGoal === "harvestDeposit") {
            const deposit = Game.getObjectById(creep.memory.depositId);
            
            // If deposit still exists and is ready
            if (deposit && deposit.cooldown === 0) {
                if (creep.harvest(deposit) === ERR_NOT_IN_RANGE) {
                    creepHelper.moveTo(creep, deposit);
                }
            } else {
                // Deposit is gone or on cooldown
                creep.memory.currentGoal = "findDeposit";
                delete creep.memory.depositId;
            }
        }
        
        // Move to target room if needed
        if (creep.memory.targetRoom && creep.room.name !== creep.memory.targetRoom) {
            const exitDir = creep.room.findExitTo(creep.memory.targetRoom);
            const exit = creep.pos.findClosestByRange(exitDir);
            creepHelper.moveTo(creep, exit);
        }
    },
    
    /**
     * Select a new room to explore with reduced chance of revisiting recent rooms
     * @param {Creep} creep - The explorer creep
     */
    selectNewTargetRoom: function(creep) {
        const availableExits = Game.map.describeExits(creep.room.name);
        const exitRooms = Object.values(availableExits);
        
        // Score each exit room (lower score is better)
        const roomScores = {};
        
        for (const room of exitRooms) {
            // Start with base score
            let score = 100;
            
            // Penalize rooms we've visited before
            if (creep.memory.visitedRooms[room]) {
                score += creep.memory.visitedRooms[room] * 50;
            }
            
            // Avoid the room we just came from
            if (creep.memory.prevRoom === room) {
                score += 200;
            }
            
            // Prefer highway rooms (rooms with one coordinate being 0)
            const roomCoords = room.match(/[EW](\d+)[NS](\d+)/);
            if (roomCoords) {
                const x = parseInt(roomCoords[1]);
                const y = parseInt(roomCoords[2]);
                
                // Highway rooms have x=0 or y=0
                if (x % 10 === 0 || y % 10 === 0) {
                    score -= 50;
                }
                
                // Intersections are better (both x and y are multiples of 10)
                if (x % 10 === 0 && y % 10 === 0) {
                    score -= 50;
                }
            }
            
            roomScores[room] = score;
        }
        
        // Sort rooms by score
        const sortedRooms = Object.keys(roomScores).sort((a, b) => roomScores[a] - roomScores[b]);
        
        // Select the best room
        if (sortedRooms.length > 0) {
            creep.memory.prevRoom = creep.room.name;
            creep.memory.targetRoom = sortedRooms[0];
            
            // Add some randomness so they don't all follow the same path
            if (sortedRooms.length > 1 && Math.random() < 0.3) {
                creep.memory.targetRoom = sortedRooms[1];
            }
        }
    },
    
    /**
     * Return to base and store collected resources
     * @param {Creep} creep - The explorer creep
     */
    storeResources: function(creep) {
        creepHelper.say(creep);
        
        // Switch back to exploring if empty
        if (creep.store.getUsedCapacity() === 0) {
            creep.memory.mode = config.MODE.exploring;
            creep.memory.currentGoal = "findDeposit";
            delete creep.memory.targetRoom;
            return;
        }
        
        // Set target room to home if not set
        if (!creep.memory.targetRoom) {
            creep.memory.targetRoom = config.ROOM_NAME;
        }
        
        // If not in home room, travel back
        if (creep.room.name !== config.ROOM_NAME) {
            const exitDir = creep.room.findExitTo(creep.memory.targetRoom);
            const exit = creep.pos.findClosestByRange(exitDir);
            creepHelper.moveTo(creep, exit);
            return;
        }
        
        // In home room, find storage
        const storage = creep.room.storage || creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_STORAGE || s.structureType === STRUCTURE_CONTAINER
        })[0];
        
        if (storage) {
            // Get first resource type in store
            const resourceType = Object.keys(creep.store)[0];
            
            if (creep.transfer(storage, resourceType) === ERR_NOT_IN_RANGE) {
                creepHelper.moveTo(creep, storage);
            }
        } else {
            // No storage available, drop resources
            const resourceType = Object.keys(creep.store)[0];
            creep.drop(resourceType);
        }
    }
};