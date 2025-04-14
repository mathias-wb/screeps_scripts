// Builder role module
const config = require('config');
const creepHelper = require('creep.helper');
const roomManager = require('manager.room');

module.exports = {
    /**
     * Run builder behavior
     * @param {Creep} creep - The builder creep
     * @param {Array} storage - Storage structures in the room
     */
    run: function(creep, storage) {
        switch (creep.memory.mode) {
            case config.MODE.harvesting:
                this.harvestEnergy(creep, creep.room.find(FIND_SOURCES), storage);
                break;
            case config.MODE.building:
                this.buildAndRepair(creep);
                break;
        }
    },
    
    /**
     * Harvest energy directly from sources or storage
     * @param {Creep} creep - The builder creep
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

        // If no storage with energy, harvest directly
        const source = energySources[0]; // Default to first source
        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
            creepHelper.moveTo(creep, source);
        }
    },
    
    /**
     * Build construction sites and repair damaged structures
     * @param {Creep} creep - The builder creep
     */
    buildAndRepair: function(creep) {
        creepHelper.say(creep);

        // Find construction sites
        const constructions = creep.room.find(FIND_MY_CONSTRUCTION_SITES);

        // Prioritize containers near miners
        const minerContainers = [];
        const miners = creep.room.find(FIND_MY_CREEPS, {
            filter: c => c.memory.role === "miner"
        });

        for (const miner of miners) {
            const sites = miner.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
                filter: site => site.structureType === STRUCTURE_CONTAINER
            });
            minerContainers.push(...sites);
        }

        // If there are construction sites, build them
        if (minerContainers.length > 0) {
            // Build miner containers first for better energy flow
            if (creep.build(minerContainers[0]) === ERR_NOT_IN_RANGE) {
                creepHelper.moveTo(creep, minerContainers[0]);
            }
            return;
        } else if (constructions.length > 0) {
            if (creep.build(constructions[0]) === ERR_NOT_IN_RANGE) {
                creepHelper.moveTo(creep, constructions[0]);
            }
            return;
        }

        // If nothing to build, repair structures
        const damagedStructures = roomManager.findDamagedStructures(creep.room);
        
        if (damagedStructures.length > 0) {
            if (creep.repair(damagedStructures[0]) === ERR_NOT_IN_RANGE) {
                creepHelper.moveTo(creep, damagedStructures[0]);
            }
        } else {
            // If nothing to build or repair, go idle
            creep.memory.mode = config.MODE.idle;
        }
    }
};