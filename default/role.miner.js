// Miner role module
const config = require('config');
const creepHelper = require('creep.helper');

module.exports = {
    /**
     * Run miner behavior
     * @param {Creep} creep - The miner creep
     */
    run: function(creep) {
        // Miners just stay by their assigned source and mine continuously
        if (!creep.memory.sourceId) return;

        const source = Game.getObjectById(creep.memory.sourceId);
        if (!source) return;

        // If not in position, move to source
        if (creep.pos.getRangeTo(source) > 1) {
            creepHelper.moveTo(creep, source);
            return;
        }

        // Find or build a container by the source
        const containers = creep.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        });

        // If no container exists, build one
        if (containers.length === 0) {
            // Check if we already have a construction site nearby
            const sites = creep.pos.findInRange(FIND_CONSTRUCTION_SITES, 1);
            if (sites.length === 0) {
                // Create a construction site for a container
                creep.room.createConstructionSite(creep.pos, STRUCTURE_CONTAINER);
            }
        }

        // Mine the source
        creep.harvest(source);
        creep.say(config.MODE.mining);

        // If we have energy and there's a container, transfer to container
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && containers.length > 0) {
            // Find the container with the most space
            let targetContainer = containers[0];
            if (containers.length > 1) {
                targetContainer = _.max(containers, c => c.store.getFreeCapacity(RESOURCE_ENERGY));
            }
            
            // Transfer energy to the container
            if (targetContainer.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                creep.transfer(targetContainer, RESOURCE_ENERGY);
            }
        }
        // Only drop energy if we have no containers and inventory is full
        else if (containers.length === 0 && creep.store.getFreeCapacity() < 20) {
            creep.drop(RESOURCE_ENERGY);
        }
    }
};
