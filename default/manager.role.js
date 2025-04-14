// Role management module
const config = require('config');
const roleHarvester = require('role.harvester');
const roleMiner = require('role.miner');
const roleBuilder = require('role.builder');
const roleUpgrader = require('role.upgrader');
const roleExplorer = require('role.explorer');

module.exports = {
    /**
     * Process each creep's behavior based on role and mode
     * @param {Array} creeps - All creeps in the room
     * @param {Array} miners - Miner creeps for harvester assignment
     * @param {Array} storage - Storage structures in the room
     */
    processCreeps: function(creeps, miners, storage) {
        for (let name in Game.creeps) {
            const creep = Game.creeps[name];
            
            // Handle mode transitions based on energy levels
            this.updateCreepMode(creep);
            
            // Execute behaviors based on current mode and role
            switch(creep.memory.role) {
                case "miner":
                    roleMiner.run(creep);
                    break;
                case "harvester":
                    roleHarvester.run(creep, miners, storage);
                    break;
                case "builder":
                    roleBuilder.run(creep, storage);
                    break;
                case "upgrader":
                    roleUpgrader.run(creep, storage);
                    break;
                case "explorer":
                    roleExplorer.run(creep)
            }
        }
    },
    
    /**
     * Update creep's mode based on its energy level and role
     * @param {Creep} creep - The creep to update
     */
    updateCreepMode: function(creep) {
        const roomManager = require('manager.room');
        
        // Skip energy collection if everything is full
        if (roomManager.roomEnergyFull(creep.room) && 
            (creep.memory.mode === config.MODE.idle || creep.memory.mode === config.MODE.harvesting) && 
            creep.memory.role === "harvester" && 
            creep.store.energy > 0) {
            creep.memory.mode = config.MODE.upgrading;
            return;
        }

        // Miners always stay in mining mode
        if (creep.memory.role === "miner") {
            creep.memory.mode = config.MODE.mining;
            return;
        }

        const energyFull = creep.store.energy === creep.store.getCapacity(RESOURCE_ENERGY);
        const energyEmpty = creep.store.energy === 0;

        // When creep is idle, decide what to do next
        if (creep.memory.mode === config.MODE.idle) {
            if (energyEmpty) {
                // Harvesters collect from miners, others harvest directly
                if (creep.memory.role === "harvester") {
                    creep.memory.mode = config.MODE.collecting;
                } else {
                    creep.memory.mode = config.MODE.harvesting;
                }
            } else if (energyFull) {
                // Put energy to use based on role
                if (creep.memory.role === "harvester") {
                    creep.memory.mode = config.MODE.storing;
                } else if (creep.memory.role === "builder") {
                    creep.memory.mode = config.MODE.building;
                } else if (creep.memory.role === "upgrader") {
                    creep.memory.mode = config.MODE.upgrading;
                }
            }
        }

        // When creep runs out of energy, go idle to reassess
        if ((creep.memory.mode === config.MODE.storing || 
            creep.memory.mode === config.MODE.building || 
            creep.memory.mode === config.MODE.upgrading) && energyEmpty) {
            creep.memory.mode = config.MODE.idle;
        }

        // When creep is full of energy, go idle to reassess
        if ((creep.memory.mode === config.MODE.harvesting || 
            creep.memory.mode === config.MODE.collecting) && energyFull) {
            creep.memory.mode = config.MODE.idle;
        }
    },
    
    /**
     * Assign miners to energy sources
     * @param {Array} miners - Array of miner creeps
     * @param {Array} sources - Array of energy sources
     */
    assignMinersToSources: function(miners, sources) {
        // Create an array to track which sources have miners
        const sourceHasMiner = Array(sources.length).fill(false);

        // Mark sources that already have miners assigned
        miners.forEach(miner => {
            if (miner.memory.sourceId) {
                const sourceIndex = sources.findIndex(source => source.id === miner.memory.sourceId);
                if (sourceIndex >= 0) {
                    sourceHasMiner[sourceIndex] = true;
                }
            }
        });

        // Assign unassigned miners to sources that need miners
        miners.forEach(miner => {
            if (!miner.memory.sourceId) {
                const sourceIndex = sourceHasMiner.indexOf(false);
                if (sourceIndex >= 0) {
                    miner.memory.sourceId = sources[sourceIndex].id;
                    sourceHasMiner[sourceIndex] = true;
                }
            }
        });
    },
    
    /**
     * Assign harvesters to miners for efficient energy collection
     * @param {Array} harvesters - Array of harvester creeps
     * @param {Array} miners - Array of miner creeps
     */
    assignHarvestersToMiners: function(harvesters, miners) {
        // Skip if we don't have enough miners yet
        if (miners.length === 0) return;
        
        // Create an array to track which miners have harvesters assigned
        const minerHasHarvester = Array(miners.length).fill(false);
        
        // Mark miners that already have harvesters assigned
        harvesters.forEach(harvester => {
            if (harvester.memory.assignedMinerId) {
                // Find the index of this miner in our miners array
                const minerIndex = miners.findIndex(miner => miner.id === harvester.memory.assignedMinerId);
                if (minerIndex >= 0) {
                    minerHasHarvester[minerIndex] = true;
                }
            }
        });
        
        // Assign unassigned harvesters to miners that need harvesters
        harvesters.forEach(harvester => {
            if (!harvester.memory.assignedMinerId) {
                // Find first miner without a harvester
                const minerIndex = minerHasHarvester.indexOf(false);
                if (minerIndex >= 0) {
                    harvester.memory.assignedMinerId = miners[minerIndex].id;
                    minerHasHarvester[minerIndex] = true;
                }
            }
        });
        
        // If we have more harvesters than miners, distribute them evenly
        // This handles cases where we have 3 harvesters but only 2 miners
        if (harvesters.length > miners.length) {
            let counter = 0;
            harvesters.forEach(harvester => {
                if (!harvester.memory.assignedMinerId) {
                    harvester.memory.assignedMinerId = miners[counter % miners.length].id;
                    counter++;
                }
            });
        }
    }
};