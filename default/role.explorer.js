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
            creep.memory.currentGoal = "findIntersection"; // Goals: findIntersection, followLine, findDeposit, harvestDeposit, returnHome
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
        
        if (creep.memory.currentGoal === "findIntersection") {
            const currentCoords = this.parseRoomName(creep.room.name);
            // Find closest intersection (room with coordinates divisible by 10)
            const targetCoords = this.findClosestIntersection(currentCoords.x, currentCoords.y);
            const targetRoom = `${targetCoords.xDir}${targetCoords.x}${targetCoords.yDir}${targetCoords.y}`;
            
            if (creep.room.name === targetRoom) {
                creep.memory.currentGoal = "followLine";
                creep.memory.direction = Math.random() < 0.5 ? "horizontal" : "vertical";
            } else {
                creep.memory.targetRoom = targetRoom;
                const exitDir = creep.room.findExitTo(creep.memory.targetRoom);
                const exit = creep.pos.findClosestByRange(exitDir);
                creepHelper.moveTo(creep, exit);
            }
        }
        
        if (creep.memory.currentGoal === "followLine") {
            const deposits = creep.room.find(FIND_DEPOSITS);
            if (deposits.length > 0) {
                creep.memory.currentGoal = "harvestDeposit";
                creep.memory.depositId = deposits[0].id;
                return;
            }
            
            const coords = this.parseRoomName(creep.room.name);
            let nextRoom;
            
            if (creep.memory.direction === "horizontal") {
                nextRoom = `${coords.xDir}${coords.x + 10}${coords.yDir}${coords.y}`;
            } else {
                nextRoom = `${coords.xDir}${coords.x}${coords.yDir}${coords.y + 10}`;
            }
            
            creep.memory.targetRoom = nextRoom;
            const exitDir = creep.room.findExitTo(creep.memory.targetRoom);
            const exit = creep.pos.findClosestByRange(exitDir);
            creepHelper.moveTo(creep, exit);
        }
        
        if (creep.memory.currentGoal === "harvestDeposit") {
            const deposit = Game.getObjectById(creep.memory.depositId);
            
            if (deposit && deposit.cooldown === 0) {
                if (creep.harvest(deposit) === ERR_NOT_IN_RANGE) {
                    creepHelper.moveTo(creep, deposit);
                }
            } else {
                creep.memory.currentGoal = "findIntersection";
                delete creep.memory.depositId;
            }
        }
    },
    
    parseRoomName: function(roomName) {
        const match = roomName.match(/([EW])(\d+)([NS])(\d+)/);
        return {
            xDir: match[1],
            x: parseInt(match[2]),
            yDir: match[3],
            y: parseInt(match[4])
        };
    },
    
    findClosestIntersection: function(x, y) {
        const targetX = Math.round(x / 10) * 10;
        const targetY = Math.round(y / 10) * 10;
        return {
            x: targetX,
            y: targetY,
            xDir: x >= 0 ? 'E' : 'W',
            yDir: y >= 0 ? 'N' : 'S'
        };
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
            creep.memory.currentGoal = "findIntersection";
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