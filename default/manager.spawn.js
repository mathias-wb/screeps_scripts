// Spawn management module
const config = require('config');

module.exports = {
    /**
     * Spawn creeps if any role is below population targets
     * @param {Array} miners - Array of miner creeps
     * @param {Array} harvesters - Array of harvester creeps
     * @param {Array} builders - Array of builder creeps
     * @param {Array} upgraders - Array of upgrader creeps
     * @param {Array} explorers - Array of explorer creeps
     */
    spawnCreepsIfNeeded: function(miners, harvesters, builders, upgraders, explorers) {
        // First priority: miners (they produce the energy)
        if (miners.length < config.POPULATION.miner) {
            this.spawnCreep("miner", config.BODY.miner);
            return; // Only spawn one creep per tick
        }

        // Second priority: harvesters (they move the energy)
        if (harvesters.length < config.POPULATION.harvester) {
            this.spawnCreep("harvester", config.BODY.harvester);
            return;
        }

        // Third priority: upgraders (they level up the room)
        if (upgraders.length < config.POPULATION.upgrader) {
            this.spawnCreep("upgrader", config.BODY.upgrader);
            return;
        }

        // Fourth priority: builders (they construct and repair)
        if (builders.length < config.POPULATION.builder) {
            this.spawnCreep("builder", config.BODY.builder);
            return;
        }

        // Last priority: explorers (they find commodities)
        // Only spawn an explorer if none exist and none are away from home
        if (explorers.length < config.POPULATION.explorer && !this.isExplorerAway()) {
            this.spawnCreep("explorer", config.BODY.explorer);
        }
    },
    
    /**
     * Check if an explorer is away from home room
     * @returns {boolean} True if an explorer is in another room
     */
    isExplorerAway: function() {
        // Check Memory.creeps for explorers in other rooms
        for (let name in Memory.creeps) {
            const creepMemory = Memory.creeps[name];
            if (creepMemory.role === "explorer" && creepMemory.homeRoom) {
                // If creep exists and is in another room, it's away
                const creep = Game.creeps[name];
                if (creep && creep.room.name !== creepMemory.homeRoom) {
                    return true;
                }
                
                // If creep doesn't exist but memory shows it was exploring, it's away
                if (!creep && creepMemory.currentGoal && 
                    creepMemory.currentGoal !== "returnHome") {
                    return true;
                }
            }
        }
        return false;
    },
    
    /**
     * Spawn a new creep with the given role and body
     * @param {string} role - The role of the creep to spawn
     * @param {Array} body - Array of body parts for the creep
     */
    spawnCreep: function(role, body) {
        Game.spawns[config.SPAWN_NAME].spawnCreep(
            body,
            role.charAt(0).toUpperCase() + role.slice(1) + Game.time,
            { memory: { role: role, mode: config.MODE.idle, sourceId: null } }
        );
    }
};