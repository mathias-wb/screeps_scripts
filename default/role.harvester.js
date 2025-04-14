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

        // If creep is full, switch to storing mode
        if (creep.store.getFreeCapacity() === 0) {
            creep.memory.mode = config.MODE.storing;
            return;
        }
        
        // First try to find the assigned miner
        let assignedMiner = null;
        if (creep.memory.assignedMinerId) {
            assignedMiner = Game.getObjectById(creep.memory.assignedMinerId);
        }
        
        // Reassign miner if none assigned or periodically
        if (!creep.memory.assignedMinerId || Game.time % 50 === 0) {
            // Calculate scores for each miner
            const minerScores = miners.map(miner => {
                // Check for container energy
                const containers = miner.pos.findInRange(FIND_STRUCTURES, 1, {
                    filter: s => s.structureType === STRUCTURE_CONTAINER
                });
                const containerEnergy = containers.reduce((sum, c) => 
                    sum + c.store.getUsedCapacity(RESOURCE_ENERGY), 0);
                
                // Check for dropped energy
                const droppedEnergy = miner.pos.findInRange(FIND_DROPPED_RESOURCES, 1)
                    .reduce((sum, r) => sum + r.amount, 0);
                
                // Calculate distance penalty (closer is better)
                const distance = creep.pos.getRangeTo(miner);
                const distanceFactor = Math.max(1, 10 - distance); // Higher for closer miners
                
                // Calculate total score (energy availability weighted by distance)
                const totalEnergy = containerEnergy + droppedEnergy + miner.store.getUsedCapacity(RESOURCE_ENERGY);
                const score = totalEnergy * distanceFactor;
                
                return {
                    id: miner.id,
                    score: score
                };
            });
            
            // Filter out miners with no energy
            const viableMiners = minerScores.filter(m => m.score > 0);
            
            if (viableMiners.length > 0) {
                // Sort by score (highest first)
                viableMiners.sort((a, b) => b.score - a.score);
                
                // Select from top 3 miners (or fewer if not enough)
                const topCount = Math.min(3, viableMiners.length);
                const selectedIndex = Math.floor(Math.random() * topCount);
                creep.memory.assignedMinerId = viableMiners[selectedIndex].id;
            } else if (miners.length > 0) {
                // If no miners have energy, just pick any random miner
                creep.memory.assignedMinerId = miners[Math.floor(Math.random() * miners.length)].id;
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

        // If creep is empty, switch to collecting mode
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            creep.memory.mode = config.MODE.collecting;
            // Clear tower assignment when switching modes
            delete creep.memory.assignedTowerId;
            return;
        }

        // IMPORTANT: Get a fresh reference to the spawn
        // This ensures we're checking current capacity, not cached data
        const spawn = Game.spawns[config.SPAWN_NAME];
        
        // Find structures needing energy
        const extensions = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION &&
                s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });

        // Get all towers that need energy
        const allTowers = creep.room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER &&
                s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });

        // Get available towers (not already assigned to other harvesters)
        const availableTowers = [];
        
        // Check if this creep already has an assigned tower
        let assignedTower = null;
        if (creep.memory.assignedTowerId) {
            assignedTower = Game.getObjectById(creep.memory.assignedTowerId);
            // If tower is full or no longer exists, clear assignment
            if (!assignedTower || assignedTower.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                delete creep.memory.assignedTowerId;
                assignedTower = null;
            }
        }
        
        // If no assigned tower, find available towers
        if (!assignedTower && allTowers.length > 0) {
            // Get all harvester creeps
            const harvesters = _.filter(Game.creeps, c => 
                c.memory.role === 'harvester' && 
                c.id !== creep.id && 
                c.memory.assignedTowerId);
            
            // Create a map of tower IDs that are already assigned
            const assignedTowerIds = {};
            harvesters.forEach(h => {
                if (h.memory.assignedTowerId) {
                    assignedTowerIds[h.memory.assignedTowerId] = true;
                }
            });
            
            // Filter towers that aren't already assigned
            for (const tower of allTowers) {
                if (!assignedTowerIds[tower.id]) {
                    availableTowers.push(tower);
                }
            }
            
            // Assign a tower if available
            if (availableTowers.length > 0) {
                // Find closest available tower
                const closestTower = creep.pos.findClosestByPath(availableTowers);
                if (closestTower) {
                    creep.memory.assignedTowerId = closestTower.id;
                    assignedTower = closestTower;
                }
            }
        }

        // Sort storage by energy (least first to distribute evenly)
        const emptyStorage = storage.filter(s => s.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
            .sort((a, b) => a.store.getUsedCapacity(RESOURCE_ENERGY) - b.store.getUsedCapacity(RESOURCE_ENERGY));

        // Energy delivery priority: 1. Spawn 2. Extensions 3. Assigned Tower 4. Storage 5. Controller
        let target = null;
        let targetStructures = [];

        // Check if spawn needs energy (using fresh reference)
        if (spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            targetStructures = [spawn];
        } else if (extensions.length > 0) {
            targetStructures = extensions;
        } else if (assignedTower) {
            // Use the assigned tower if it exists
            targetStructures = [assignedTower];
        } else if (emptyStorage.length > 0) {
            targetStructures = emptyStorage;
        } else {
            // If nowhere to store, upgrade controller
            creep.memory.mode = config.MODE.upgrading;
            // Clear tower assignment when switching to upgrading
            delete creep.memory.assignedTowerId;
            return;
        }

        // Find the closest structure in the current priority category
        target = creep.pos.findClosestByPath(targetStructures);
                
        if (!target) {
            // Fallback to first structure if pathfinding fails
            target = targetStructures[0];
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
        
        // If creep is empty, switch to collecting mode
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            creep.memory.mode = config.MODE.collecting;
            // Clear tower assignment when switching modes
            delete creep.memory.assignedTowerId;
            return;
        }
        
        if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
            creepHelper.moveTo(creep, creep.room.controller);
        }
    }
};