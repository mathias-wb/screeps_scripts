// Core references
const home = Game.spawns["Home"];
const room = Game.rooms["E15N11"];
const controller = home.room.controller;
const energySources = room.find(FIND_SOURCES);

// Population targets
const POPULATION = {
    harvester: 4,
    builder: 2
};

// Mode symbols
const MODE = {
    idle: "💤",
    harvesting: "⚡️",
    storing: "🔋",
    building: "🚧"
};

// Visualization settings
const PATH_STYLE = {
    stroke: "#FFFF68",
    strokeWidth: 0.1,
    opacity: 0.2,
    lineStyle: "dashed"
};

function spawnCreepsIfNeeded(harvesters, builders) {
    if (harvesters.length < POPULATION.harvester) {
        home.spawnCreep(
            [WORK, WORK, CARRY, MOVE, MOVE, MOVE],
            "Harvester" + Game.time,
            { memory: { role: "harvester", mode: MODE.idle } }
        );
    }

    if (builders.length < POPULATION.builder) {
        home.spawnCreep(
            [WORK, WORK, CARRY, CARRY, MOVE, MOVE],
            "Builder" + Game.time,
            { memory: { role: "builder", mode: MODE.idle } }
        );
    }
}

function updateCreepMode(creep) {
    const energyFull = creep.store.energy === creep.store.getCapacity(RESOURCE_ENERGY);
    const energyEmpty = creep.store.energy === 0;

    // Idle creep with no energy should harvest
    if (creep.memory.mode === MODE.idle && !energyFull) {
        creep.memory.mode = MODE.harvesting;
    }

    // Full harvesters should store energy
    if (creep.memory.role === "harvester" && energyFull) {
        creep.memory.mode = MODE.storing;
    }

    // Full builders should build
    if (creep.memory.role === "builder" && energyFull) {
        creep.memory.mode = MODE.building;
    }

    // Empty creeps go back to idle
    if ((creep.memory.mode === MODE.storing || creep.memory.mode === MODE.building) && energyEmpty) {
        creep.memory.mode = MODE.idle;
    }
}

function harvestEnergy(creep, energySources, storage) {
    // Display energy percentage
    const energyPercent = Math.floor((creep.store.energy / creep.store.getCapacity()) * 100);
    creep.say(creep.memory.mode + energyPercent + "%");

    if (creep.memory.role === "harvester") {
        // Harvesters get energy from sources
        if (creep.harvest(energySources[0]) === ERR_NOT_IN_RANGE) {
            creep.moveTo(energySources[0], { visualizePathStyle: PATH_STYLE });
            creep.say(creep.memory.mode + "🚶‍♂️📍");
        }
    } else if (creep.memory.role === "builder") {
        // Builders get energy from storage
        if (storage.length > 0) {
            // Sort by energy content (most first)
            storage.sort((a, b) =>
                b.store.getUsedCapacity(RESOURCE_ENERGY) -
                a.store.getUsedCapacity(RESOURCE_ENERGY)
            );

            if (creep.withdraw(storage[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(storage[0], { visualizePathStyle: PATH_STYLE });
                creep.say(creep.memory.mode + "🚶‍♂️📦");
            }
        }
    }
}

function storeEnergy(creep, home, room, storage) {
    const energyPercent = Math.floor((creep.store.energy / creep.store.getCapacity()) * 100);
    creep.say(creep.memory.mode + energyPercent + "%");

    // Sort storage by energy (least first to distribute evenly)
    storage.sort((a, b) =>
        a.store.getUsedCapacity(RESOURCE_ENERGY) -
        b.store.getUsedCapacity(RESOURCE_ENERGY)
    );

    // Find structures needing energy
    const extensions = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_EXTENSION &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });

    const emptyStorage = storage.filter(s => s.store.getFreeCapacity(RESOURCE_ENERGY) > 0);

    // Energy delivery priority: 1. Spawn 2. Extensions 3. Storage 4. Controller
    let target = null;
    let message = "";

    if (home.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        target = home;
        message = "🚶‍♂️🏡";
    } else if (extensions.length > 0) {
        target = extensions[0];
        message = "🚶‍♂️💡";
    } else if (emptyStorage.length > 0) {
        target = emptyStorage[0];
        message = "🚶‍♂️📦";
    } else {
        target = controller;
        message = "🚶‍♂️🎮";
    }

    // Move to target and transfer energy
    if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { visualizePathStyle: PATH_STYLE });
        creep.say(creep.memory.mode + message);
    }
}

function buildAndRepair(creep, room) {
    const energyPercent = Math.floor((creep.store.energy / creep.store.getCapacity()) * 100);
    creep.say(creep.memory.mode + energyPercent + "%");

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
    damagedStructures.sort((a, b) => {
        const isInfraA = a.structureType === STRUCTURE_ROAD || a.structureType === STRUCTURE_CONTAINER;
        const isInfraB = b.structureType === STRUCTURE_ROAD || b.structureType === STRUCTURE_CONTAINER;

        if (isInfraA && !isInfraB) return -1;
        if (!isInfraA && isInfraB) return 1;

        return (a.hits / a.hitsMax) - (b.hits / b.hitsMax);
    });

    // Find construction sites
    const constructions = room.find(FIND_MY_CONSTRUCTION_SITES);

    // Repair has priority over building
    if (damagedStructures.length > 0) {
        if (creep.repair(damagedStructures[0]) === ERR_NOT_IN_RANGE) {
            creep.moveTo(damagedStructures[0], { visualizePathStyle: PATH_STYLE });
            creep.say(creep.memory.mode + "🚶‍♂️🔧");
        }
    } else if (constructions.length > 0) {
        if (creep.build(constructions[0]) === ERR_NOT_IN_RANGE) {
            creep.moveTo(constructions[0], { visualizePathStyle: PATH_STYLE });
            creep.say(creep.memory.mode + "🚶‍♂️📍");
        }
    } else {
        creep.memory.mode = MODE.idle;
        creep.say(MODE.idle);
    }
}

function cleanupMemory() {
    for (let name in Memory.creeps) {
        if (!Game.creeps[name]) {
            delete Memory.creeps[name];
        }
    }
}

module.exports.loop = function () {
    // Get all creeps and storage structures
    const creeps = room.find(FIND_MY_CREEPS);
    const harvesters = creeps.filter(creep => creep.memory.role === "harvester");
    const builders = creeps.filter(creep => creep.memory.role === "builder");

    const storage = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_STORAGE ||
            s.structureType === STRUCTURE_CONTAINER
    });

    // Spawn new creeps if below population targets
    spawnCreepsIfNeeded(harvesters, builders);

    // Process each creep's behavior
    for (let name in Game.creeps) {
        const creep = Game.creeps[name];

        // Handle mode transitions based on energy levels
        updateCreepMode(creep);

        // Execute behaviors based on current mode
        switch (creep.memory.mode) {
            case MODE.harvesting:
                harvestEnergy(creep, energySources, storage);
                break;
            case MODE.storing:
                storeEnergy(creep, home, room, storage);
                break;
            case MODE.building:
                buildAndRepair(creep, room);
                break;
        }
    }

    // Clean up memory for dead creeps
    cleanupMemory();
};