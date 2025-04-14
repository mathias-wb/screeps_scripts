// Harvester role module
const config = require('config');
const creepHelper = require('creep.helper');
const roomManager = require('manager.room');

module.exports = {
    /**
     * Run harvester behavior
     * @param {Creep} creep - The harvester creep
     * @param {Array} miners - Array of miner creeps for collection
     * @param {Array} storage - Storage structures
     */
    run: function(creep, miners, storage) {
        switch (creep.memory.mode) {
            case config.MODE.collecting:
                this.collectFromMiner(creep, miners);
                break;
            case config.MODE.harvesting:
                this.harvestEnergy(creep, creep.room.find(FIND_SOURCES), storage);
                break;
            case config.MODE.storing:
                this.storeEnergy(creep, storage);
                break;
            case config.MODE.upgrading:
                this.upgradeController(creep);
                break;
        }
    },
    
    /**
     * Collect energy from miners
     * @param {Creep} creep - The harvester creep
     * @param {Array} miners - Array of miner creeps
     */
    collectFromMiner: function(creep, miners) {
        // If no miners yet, fall back to direct harvesting
        if (miners.length === 0) {
            creep.memory.mode = config.MODE.harvesting;
            return;
        }

        // Display energy percentage
        creepHelper.say(creep);
        
        // First try to find the assigned miner
        let assignedMiner = null;
        if (creep.memory.assignedMinerId) {
            assignedMiner = Game.getObjectById(creep.memory.assignedMinerId);
        }
        
        // If our assigned miner exists, focus on it
        if (assignedMiner) {
            // First check for containers near assigned miner
            const containers = assignedMiner.pos.findInRange(FIND_STRUCTURES, 1, {
                filter: s => s.structureType === STRUCTURE_CONTAINER &&
                    s.store.getUsedCapacity(RESOURCE_ENERGY) > 0
            });
            
            if (containers.length > 0) {
                if (creep.withdraw(containers[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creepHelper.moveTo(creep, containers[0]);
                }
                return;
            }
            
            // Next check for dropped energy near assigned miner
            const droppedResources = assignedMiner.pos.findInRange(FIND_DROPPED_RESOURCES, 1);
            
            if (droppedResources.length > 0) {
                if (creep.pickup(droppedResources[0]) === ERR_NOT_IN_RANGE) {
                    creepHelper.moveTo(creep, droppedResources[0]);
                }
                return;
            }
            
            // Try to get energy directly from assigned miner
            if (assignedMiner.store.energy > 0) {
                if (creep.pos.isNearTo(assignedMiner)) {
                    assignedMiner.transfer(creep, RESOURCE_ENERGY);
                } else {
                    creepHelper.moveTo(creep, assignedMiner);
                }
                return;
            }
        }
        
        // First check for containers near miners
        const minerContainers = [];
        for (const miner of miners) {
            const nearbyContainers = miner.pos.findInRange(FIND_STRUCTURES, 1, {
                filter: s => s.structureType === STRUCTURE_CONTAINER &&
                    s.store.getUsedCapacity(RESOURCE_ENERGY) > 0
            });
            minerContainers.push(...nearbyContainers);
        }

        if (minerContainers.length > 0) {
            // Sort by energy content
            minerContainers.sort((a, b) =>
                b.store.getUsedCapacity(RESOURCE_ENERGY) -
                a.store.getUsedCapacity(RESOURCE_ENERGY)
            );

            // Withdraw from container with most energy
            if (creep.withdraw(minerContainers[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creepHelper.moveTo(creep, minerContainers[0]);
            }
            return;
        }

        // Next check for dropped energy near miners
        const droppedResources = [];
        for (const miner of miners) {
            const resources = miner.pos.findInRange(FIND_DROPPED_RESOURCES, 1);
            droppedResources.push(...resources);
        }

        if (droppedResources.length > 0) {
            // Sort by amount
            droppedResources.sort((a, b) => b.amount - a.amount);

            // Pick up the largest pile
            if (creep.pickup(droppedResources[0]) === ERR_NOT_IN_RANGE) {
                creepHelper.moveTo(creep, droppedResources[0]);
            }
            return;
        }

        // As a last resort, try to get energy directly from a miner
        let bestMiner = null;
        let bestScore = -1;

        for (const miner of miners) {
            if (miner.store.energy > 0) {
                const distance = creep.pos.getRangeTo(miner);
                const score = miner.store.energy - (distance * 10); // Prioritize closer miners

                if (score > bestScore) {
                    bestScore = score;
                    bestMiner = miner;
                }
            }
        }

        if (bestMiner) {
            // Transfer energy from miner to harvester
            if (creep.pos.isNearTo(bestMiner)) {
                bestMiner.transfer(creep, RESOURCE_ENERGY);
            } else {
                creepHelper.moveTo(creep, bestMiner);
            }
            return;
        }

        // If still no energy found, fall back to direct harvesting
        creep.memory.mode = config.MODE.harvesting;
    },
    
    /**
     * Harvest energy directly from sources
     * @param {Creep} creep - The harvester creep
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
     * Store energy in spawn, extensions, or storage
     * @param {Creep} creep - The harvester creep
     * @param {Array} storage - Storage structures in the room
     */
    storeEnergy: function(creep, storage) {
        // Display energy status
        creepHelper.say(creep);

        // IMPORTANT: Get a fresh reference to the spawn
        // This ensures we're checking current capacity, not cached data
        const spawn = Game.spawns[config.SPAWN_NAME];
        
        // Find structures needing energy
        const extensions = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION &&
                s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });

        const towers = creep.room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });

        // Sort storage by energy (least first to distribute evenly)
        const emptyStorage = storage.filter(s => s.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
            .sort((a, b) => a.store.getUsedCapacity(RESOURCE_ENERGY) - b.store.getUsedCapacity(RESOURCE_ENERGY));

        // Energy delivery priority: 1. Spawn 2. Extensions 3. Tower 4. Storage 5. Controller
        let target = null;

        // Check if spawn needs energy (using fresh reference)
        if (spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            target = spawn;
        } else if (extensions.length > 0) {
            target = extensions[0];
        } else if (towers.length > 0) {
            target = towers[0];
        } else if (emptyStorage.length > 0) {
            target = emptyStorage[0];
        } else {
            // If nowhere to store, upgrade controller
            this.upgradeController(creep);
            return;
        }

        // Move to target and transfer energy
        if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creepHelper.moveTo(creep, target);
        }
    },
    
    
    /**
     * Upgrade the room controller
     * @param {Creep} creep - The harvester creep
     */
    upgradeController: function(creep) {
        creepHelper.say(creep);
        
        if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
            creepHelper.moveTo(creep, creep.room.controller);
        }
    }
};