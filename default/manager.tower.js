/**
 * Tower manager module
 * Handles tower operations in priority order:
 * 1. Attack intruders
 * 2. Heal injured creeps with >50% lifespan remaining
 * 3. Repair damaged structures
 * 4. Heal remaining creeps
 */
module.exports = {
    /**
     * Run tower logic for a specific room
     * @param {Room} room - The room to manage towers in
     */
    run: function(room) {
        // Get all towers in the room
        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: structure => structure.structureType === STRUCTURE_TOWER
        });
        
        if (towers.length === 0) return;
        
        // Process each tower
        for (const tower of towers) {
            // Priority 1: Attack closest intruders
            const hostiles = room.find(FIND_HOSTILE_CREEPS);
            if (hostiles.length > 0) {
                let target = tower.pos.findClosestByRange(hostiles)
                tower.attack(target);
                continue; // Skip to next tower
            }
            
            // Priority 2: Heal injured creeps with >50% lifespan left
            const injuredCreepsWithLifespan = room.find(FIND_MY_CREEPS, {
                filter: creep => {
                    return creep.hits < creep.hitsMax && 
                           creep.ticksToLive > (CREEP_LIFE_TIME / 2);
                }
            });
            
            if (injuredCreepsWithLifespan.length > 0) {
                tower.heal(injuredCreepsWithLifespan[0]);
                continue; // Skip to next tower
            }
            
            // Priority 3: Repair damaged structures
            const damagedStructures = room.find(FIND_STRUCTURES, {
                filter: structure => {
                    // Don't waste energy repairing walls/ramparts above a certain threshold
                    if (structure.structureType === STRUCTURE_WALL || 
                        structure.structureType === STRUCTURE_RAMPART) {
                        return structure.hits < Math.min(structure.hitsMax, 10000);
                    }
                    return structure.hits < structure.hitsMax;
                }
            });
            
            // Sort by hit percentage (most damaged first)
            damagedStructures.sort((a, b) => (a.hits / a.hitsMax) - (b.hits / b.hitsMax));
            
            if (damagedStructures.length > 0) {
                tower.repair(damagedStructures[0]);
                continue; // Skip to next tower
            }
            
            // Priority 4: Heal remaining creeps
            const remainingInjuredCreeps = room.find(FIND_MY_CREEPS, {
                filter: creep => creep.hits < creep.hitsMax
            });
            
            if (remainingInjuredCreeps.length > 0) {
                tower.heal(remainingInjuredCreeps[0]);
            }
        }
    },
    
    /**
     * Initialize tower management for all rooms
     */
    runAll: function() {
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (room.controller && room.controller.my) {
                this.run(room);
            }
        }
    }
};