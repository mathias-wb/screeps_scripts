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
        builder: 2,
        upgrader: 2,
        explorer: 0
    },
    
    // Creep body part configurations
    BODY: {
        miner: [WORK, WORK, WORK, WORK, WORK,  // 500 (mines 10 energy/second)
            MOVE, MOVE, MOVE, MOVE, MOVE],  // + 250 = 750 energy

        harvester: [CARRY, CARRY, CARRY, CARRY, CARRY,  // 250
            WORK, WORK, // + 200
            MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE],  // + 300 = 750 energy

        builder: [WORK, WORK, WORK, // 300
            CARRY, CARRY, CARRY, // + 150
            MOVE, MOVE, MOVE, MOVE, MOVE, MOVE],  // + 300 = 750 energy

        upgrader: [WORK, WORK, WORK, // 300
            CARRY, CARRY, CARRY, // + 150
            MOVE, MOVE, MOVE, MOVE, MOVE, MOVE],  // + 300 = 750 energy

        explorer: [WORK, WORK, WORK, // 300
            CARRY, CARRY, CARRY, // + 150
            MOVE, MOVE, MOVE, MOVE, MOVE, MOVE]  // + 300 = 750 energy
    },
    
    // Mode symbols for visualization
    MODE: {
        idle: "💤",
        harvesting: "⚡️",
        mining: "⛏️",
        storing: "📦",
        building: "🚧",
        upgrading: "📈",
        collecting: "🧺",
        exploring: "🔭"
    },
    
    // Visualization settings
    PATH_STYLE: {
        stroke: "#FFFF68",
        strokeWidth: 0.1,
        opacity: 0.2,
        lineStyle: "dashed"
    }
};
