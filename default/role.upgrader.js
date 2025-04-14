// Upgrader role module
const config = require('config');
const creepHelper = require('creep.helper');

module.exports = {
    /**
     * Run upgrader behavior
     * @param {Creep} creep - The upgrader creep
     * @param {Array} storage - Storage structures in the room
     */
    run: function(creep, storage) {
        switch (creep.memory.mode) {
            case config.MODE.harvesting:
                this.harvestEnergy(creep, creep.room.find(FIND_SOURCES), storage);
                break;
            case config.MODE.upgrading:
                this.upgradeController(creep);
                break;
        }
    },
    
    /**
     * Harvest energy directly from sources or storage
     * @param {Creep} creep - The upgrader creep
     * @param {Array} energySources - Energy sources in the room
     * @param {Array} storage - Storage structures in the room
     */
    harvestEnergy: function(creep, energySources, storage) {
        creepHelper.say(creep);

        // First try to get energy from storage
        if (storage.length > 0) {
            // Sort by energy content (most first)
            storage.sort((a, b) =>
                b.store.getUsedCapacity(RESOURCE_ENERGY) -
                a.store.getUsedCapacity(RESOURCE_ENERGY)
            );

            if (storage[0].store.getUsedCapacity(RESOURCE_ENERGY) > 50) {
                if (creep.withdraw(storage[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creepHelper.moveTo(creep, storage[0]);
                    return;
                }
            }
        }
    },
    
    /**
     * Upgrade the room controller
     * @param {Creep} creep - The upgrader creep
     */
    upgradeController: function(creep) {
        creepHelper.say(creep);
        
        if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
            creepHelper.moveTo(creep, creep.room.controller);
        }
    }
};