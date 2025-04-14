// Configuration constants
module.exports = {
    // Room settings
    ROOM_NAME: "E15N11",
    SPAWN_NAME: "Home",
    
    // Population targets
    POPULATION: {
        // Population will be determined dynamically based on energy sources
        miner: null, // One miner per source (set in room.manager)
        harvester: 2,
        builder: 1,
        upgrader: 2
    },
    
    // Creep body part configurations
    BODY: {
        miner: [WORK, WORK, WORK, WORK, WORK, MOVE],  // 550 energy (mines 10 energy/second)
        harvester: [CARRY, CARRY, CARRY, CARRY, WORK, MOVE, MOVE, MOVE, MOVE, MOVE],  // 550 energy
        builder: [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE],  // 550 energy
        upgrader: [WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE]  // 550 energy (focused on upgrading)
    },
    
    // Mode symbols for visualization
    MODE: {
        idle: "💤",
        harvesting: "⚡️",
        mining: "⛏️",
        storing: "📦",
        building: "🚧",
        upgrading: "📈",
        collecting: "🧺"
    },
    
    // Visualization settings
    PATH_STYLE: {
        stroke: "#FFFF68",
        strokeWidth: 0.1,
        opacity: 0.2,
        lineStyle: "dashed"
    }
};
