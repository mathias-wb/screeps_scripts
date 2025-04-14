// Main game loop module
const roleManager = require('manager.role');
const spawnManager = require('manager.spawn');
const memoryManager = require('manager.memory');
const roomManager = require('manager.room');
const towerManager = require("manager.tower");

module.exports.loop = function() {
    // Initialize core game state
    const gameState = roomManager.initializeGameState();
    
    // Clean up memory of dead creeps
    memoryManager.cleanupMemory();
    
    // Spawn new creeps if needed
    spawnManager.spawnCreepsIfNeeded(
        gameState.miners, 
        gameState.harvesters, 
        gameState.builders, 
        gameState.upgraders
    );

    // Run tower logic
    towerManager.runAll();
    
    // Assign miners to energy sources if needed
    roleManager.assignMinersToSources(gameState.miners, gameState.energySources);
    
    // Assign harvesters to miners if needed
    roleManager.assignHarvestersToMiners(gameState.harvesters, gameState.miners);
    
    // Process each creep's behavior
    roleManager.processCreeps(gameState.creeps, gameState.miners, gameState.storage);
};