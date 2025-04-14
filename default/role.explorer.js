// Explorer role module
const config = require('config');
const creepHelper = require('creep.helper');

module.exports = {
    run: function(creep) {
        if (!creep.memory.mode || creep.memory.mode === config.MODE.idle) {
            creep.memory.mode = config.MODE.exploring;
            creep.memory.currentGoal = "findHighway";
            creep.memory.homeRoom = creep.room.name;
        }
        
        if (creep.store.getFreeCapacity() === 0 && creep.memory.mode === config.MODE.exploring) {
            creep.memory.mode = config.MODE.storing;
            return;
        }
        
        if (creep.store.getUsedCapacity() === 0 && creep.memory.mode === config.MODE.storing) {
            if (creep.memory.foundDeposit) {
                creep.suicide();
                return;
            }
            creep.memory.mode = config.MODE.exploring;
            return;
        }
        
        if (creep.memory.mode === config.MODE.exploring) {
            this.exploreAndHarvest(creep);
        } else if (creep.memory.mode === config.MODE.storing) {
            this.storeResources(creep);
        } else {
            creep.memory.mode = config.MODE.exploring;
        }
    },
    
    exploreAndHarvest: function(creep) {
        creepHelper.say(creep);
        creep.memory.mode = config.MODE.exploring;
        
        if (creep.memory.currentGoal === "findHighway") {
            const coords = this.parseRoomName(creep.room.name);
            
            // Check if on a highway (0 or 10-divisible coordinate)
            if ((coords.x % 10 === 0 && coords.y % 10 !== 0) || 
                (coords.y % 10 === 0 && coords.x % 10 !== 0)) {
                creep.memory.currentGoal = "followHighway";
                creep.memory.direction = coords.x % 10 === 0 ? "vertical" : "horizontal";
                return;
            }
            
            // Find nearest highway room
            let targetRoom;
            const distToXHighway = Math.min(coords.x % 10, 10 - (coords.x % 10));
            const distToYHighway = Math.min(coords.y % 10, 10 - (coords.y % 10));
            
            if (distToXHighway <= distToYHighway) {
                // Go to X highway
                const targetX = Math.round(coords.x / 10) * 10;
                targetRoom = `${coords.xDir}${targetX}${coords.yDir}${coords.y}`;
            } else {
                // Go to Y highway
                const targetY = Math.round(coords.y / 10) * 10;
                targetRoom = `${coords.xDir}${coords.x}${coords.yDir}${targetY}`;
            }
            
            this.moveToRoom(creep, targetRoom);
        }
        
        else if (creep.memory.currentGoal === "followHighway") {
            // Check for deposits (NOT minerals) in current room
            // IMPORTANT: In actual game use FIND_DEPOSITS
            const deposits = creep.room.find(FIND_DEPOSITS);
            
            if (deposits.length > 0) {
                creep.memory.currentGoal = "harvestDeposit";
                creep.memory.depositId = deposits[0].id;
                return;
            }
            
            // Check if we're in a room just off a highway where deposits might spawn
            const coords = this.parseRoomName(creep.room.name);
            if (coords.x % 10 !== 0 && coords.y % 10 !== 0) {
                // Check if we're in a potential deposit room (sk room)
                if ((Math.abs(5 - (coords.x % 10)) <= 1) && 
                    (Math.abs(5 - (coords.y % 10)) <= 1)) {
                    // We're in a potential SK room, explore more carefully
                    const potentialDepositSpots = creep.room.find(FIND_STRUCTURES, {
                        filter: s => s.structureType === STRUCTURE_KEEPER_LAIR
                    });
                    
                    if (potentialDepositSpots.length > 0) {
                        // This is an SK room, look carefully for deposits
                        const deposits = creep.room.find(FIND_DEPOSITS);
                        if (deposits.length > 0) {
                            creep.memory.currentGoal = "harvestDeposit";
                            creep.memory.depositId = deposits[0].id;
                            return;
                        }
                    }
                }
                
                // Not a deposit room, return to highway
                creep.memory.currentGoal = "findHighway";
                return;
            }
            
            // Continue along highway
            let nextRoom;
            if (creep.memory.direction === "horizontal") {
                // We're on a Y-divisible highway, move along X
                const nextX = coords.x + (Math.random() < 0.5 ? 1 : -1);
                nextRoom = `${coords.xDir}${nextX}${coords.yDir}${coords.y}`;
            } else {
                // We're on an X-divisible highway, move along Y
                const nextY = coords.y + (Math.random() < 0.5 ? 1 : -1);
                nextRoom = `${coords.xDir}${coords.x}${coords.yDir}${nextY}`;
            }
            
            this.moveToRoom(creep, nextRoom);
        }
        
        else if (creep.memory.currentGoal === "harvestDeposit") {
            const deposit = Game.getObjectById(creep.memory.depositId);
            
            if (deposit) {
                // For deposits, check if it has cooldown
                if (deposit.cooldown === 0) {
                    if (creep.harvest(deposit) === ERR_NOT_IN_RANGE) {
                        creepHelper.moveTo(creep, deposit);
                    }
                    creep.memory.foundDeposit = true;
                } else {
                    creepHelper.say(creep);
                }
                // Return home if nearly full
                if (creep.store.getFreeCapacity() < 10) {
                    creep.memory.mode = config.MODE.storing;
                }
            } else {
                delete creep.memory.depositId;
                creep.memory.currentGoal = "findHighway";
            }
        }
    },
    
    parseRoomName: function(roomName) {
        const match = roomName.match(/([EW])(\d+)([NS])(\d+)/);
        if (!match) return { xDir: 'E', x: 0, yDir: 'N', y: 0 };
        return {
            xDir: match[1],
            x: parseInt(match[2]),
            yDir: match[3],
            y: parseInt(match[4])
        };
    },
    
    moveToRoom: function(creep, roomName) {
        if (creep.room.name === roomName) return true;
        
        const exitDir = Game.map.findExit(creep.room, roomName);
        if (exitDir === ERR_NO_PATH) {
            creep.memory.currentGoal = "findHighway";
            return false;
        }
        
        const exit = creep.pos.findClosestByPath(exitDir);
        if (!exit) {
            creep.memory.currentGoal = "findHighway";
            return false;
        }
        
        creepHelper.moveTo(creep, exit);
        return true;
    },
    
    storeResources: function(creep) {
        creepHelper.say(creep);
        creep.memory.mode = config.MODE.storing;
        
        if (!creep.memory.homeRoom) {
            creep.memory.homeRoom = config.ROOM_NAME;
        }
        
        if (creep.room.name !== creep.memory.homeRoom) {
            this.moveToRoom(creep, creep.memory.homeRoom);
            return;
        }
        
        const storage = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_STORAGE || 
                     s.structureType === STRUCTURE_CONTAINER
        })[0];
        
        if (storage) {
            for (const resourceType in creep.store) {
                if (creep.transfer(storage, resourceType) === ERR_NOT_IN_RANGE) {
                    creepHelper.moveTo(creep, storage);
                    return;
                }
            }
        } else {
            for (const resourceType in creep.store) {
                creep.drop(resourceType);
            }
        }
    }
};