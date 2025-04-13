/**
 * Finds all available harvesting spots around energy sources in a room
 * @param {Room} room - The room to scan for energy sources and available spots
 * @returns {Object} - Map of source IDs to arrays of available positions
 */
function findHarvestingSpots(room) {
    // Get all energy sources in the room
    const sources = room.find(FIND_SOURCES);
    const result = {};

    // Process each source
    for (const source of sources) {
        const sourceId = source.id;
        result[sourceId] = [];
        
        // Check all adjacent tiles (3x3 area around the source)
        const pos = source.pos;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                // Skip the source position itself
                if (dx === 0 && dy === 0) continue;
                
                const x = pos.x + dx;
                const y = pos.y + dy;
                
                // Skip positions outside room boundaries
                if (x < 0 || y < 0 || x > 49 || y > 49) continue;
                
                // Check if the position is walkable (no walls, structures, etc.)
                const terrain = room.getTerrain();
                const terrainType = terrain.get(x, y);
                
                // Plain (0) and swamp (2) are walkable, wall (1) is not
                if (terrainType !== TERRAIN_MASK_WALL) {
                    // Ensure no structures blocking the spot (like spawns, extensions, etc.)
                    const structures = room.lookForAt(LOOK_STRUCTURES, x, y);
                    const blockingStructure = structures.find(structure => 
                        !structure.isWalkable && 
                        structure.structureType !== STRUCTURE_ROAD
                    );
                    
                    // If no blocking structures, this is a valid harvesting spot
                    if (!blockingStructure) {
                        result[sourceId].push(new RoomPosition(x, y, room.name));
                    }
                }
            }
        }
    }
    
    return result;
}