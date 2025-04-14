const config = require('config');
const creepHelper = require('creep.helper');
const roomManager = require('manager.room');

module.exports = {
    run: function(creep) {
        if (creep.memory.harvesting && creep.store.getFreeCapacity() === 0) {
            // Switch to returning to base
            creep.memory.harvesting = false;
            creep.say('🚚 Returning');
        }
        if (!creep.memory.harvesting && creep.store.getUsedCapacity() === 0) {
            // Switch to harvesting
            creep.memory.harvesting = true;
            creep.say('🔄 Harvesting');
        }

        if (creep.memory.harvesting) {
            // Find deposits in highway rooms
            if (!creep.memory.targetRoom || creep.room.name === creep.memory.targetRoom) {
                const highwayRooms = Game.map.describeExits(creep.room.name);
                creep.memory.targetRoom = Object.values(highwayRooms)[Math.floor(Math.random() * Object.values(highwayRooms).length)];
            }

            if (creep.room.name !== creep.memory.targetRoom) {
                // Move to the target room
                const exitDir = creep.room.findExitTo(creep.memory.targetRoom);
                const exit = creep.pos.findClosestByRange(exitDir);
                creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffaa00' } });
            } else {
                // Harvest from deposits in the room
                const deposit = creep.pos.findClosestByPath(FIND_DEPOSITS, {
                    filter: (d) => d.cooldown === 0
                });

                if (deposit) {
                    if (creep.harvest(deposit) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(deposit, { visualizePathStyle: { stroke: '#ffaa00' } });
                    }
                } else {
                    // No deposits available, pick a new target room
                    creep.memory.targetRoom = null;
                }
            }
        } else {
            // Return to base and store commodities
            const storage = creep.room.storage;
            if (storage) {
                if (creep.transfer(storage, Object.keys(creep.store)[0]) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffffff' } });
                }
            }
        }
    }
};