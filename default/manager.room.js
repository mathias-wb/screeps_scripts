// Room management module
const config = require('config');

module.exports = {
    /**
     * Initialize the game state with references to core objects
     * @returns {Object} Game state object with references to essential room components
     */
    initializeGameState: function() {
        // Core references
        const home = Game.spawns[config.SPAWN_NAME];
        const room = Game.rooms[config.ROOM_NAME];
        const controller = home.room.controller;
        const energySources = room.find(FIND_SOURCES);
        
        // Set dynamic population based on sources
        config.POPULATION.miner = energySources.length;
        
        // Get all creeps and group by role
        const creeps = room.find(FIND_MY_CREEPS);
        const miners = creeps.filter(creep => creep.memory.role === "miner");
        const harvesters = creeps.filter(creep => creep.memory.role === "harvester");
        const builders = creeps.filter(creep => creep.memory.role === "builder");
        const upgraders = creeps.filter(creep => creep.memory.role === "upgrader");
        
        // Get storage structures
        const storage = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_STORAGE || s.structureType === STRUCTURE_CONTAINER
        });
        
        return {
            home,
            room,
            controller,
            energySources,
            creeps,
            miners,
            harvesters,
            builders,
            upgraders,
            storage
        };
    },
    
    /**
     * Check if the room's energy storage is full
     * @param {Room} room - The room to check
     * @returns {boolean} True if all energy storage is full
     */
    roomEnergyFull: function(room) {
        // Check if spawn is full
        const home = Game.spawns[config.SPAWN_NAME];
        if (home.store.getFreeCapacity(RESOURCE_ENERGY) > 0) return false;
        
        // Check if extensions are full
        const extensions = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION
        });
        
        if (extensions.some(e => e.store.getFreeCapacity(RESOURCE_ENERGY) > 0)) return false;
        
        // Check if storage structures have space
        const storage = room.find(FIND_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_STORAGE || 
                        s.structureType === STRUCTURE_CONTAINER) &&
                        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        
        return storage.length === 0;
    },
    
    /**
     * Find damaged structures that need repair
     * @param {Room} room - The room to search
     * @returns {Array} Sorted array of damaged structures
     */
    findDamagedStructures: function(room) {
        // Find damaged structures
        const damagedStructures = room.find(FIND_STRUCTURES, {
            filter: structure => {
                // Check walls and ramparts
                if (structure.structureType === STRUCTURE_WALL ||
                    structure.structureType === STRUCTURE_RAMPART) {
                    return structure.hits < structure.hitsMax;
                }

                // Check owned structures
                if (structure.my) {
                    return structure.hits < structure.hitsMax;
                }

                // Check roads and containers
                if (structure.structureType === STRUCTURE_ROAD ||
                    structure.structureType === STRUCTURE_CONTAINER) {
                    return structure.hits < structure.hitsMax;
                }

                return false;
            }
        });

        // Sort by priority: roads/containers first, then by damage percentage
        return damagedStructures.sort((a, b) => {
            const isInfraA = a.structureType === STRUCTURE_ROAD || a.structureType === STRUCTURE_CONTAINER;
            const isInfraB = b.structureType === STRUCTURE_ROAD || b.structureType === STRUCTURE_CONTAINER;

            if (isInfraA && !isInfraB) return -1;
            if (!isInfraA && isInfraB) return 1;

            return (a.hits / a.hitsMax) - (b.hits / b.hitsMax);
        });
    }
};