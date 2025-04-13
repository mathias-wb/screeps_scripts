// Core references
const home = Game.spawns["Home"];
const room = Game.rooms["E15N11"];
const controller = home.room.controller;
const energySources = room.find(FIND_SOURCES);

// Population targets
const POPULATION = {
  miner: energySources.length, // One miner per source
  harvester: 2,
  builder: 2
};

// Mode symbols
const MODE = {
  idle: "💤",
  harvesting: "⚡️",
  mining: "⛏️",
  storing: "🔋",
  building: "🚧",
  upgrading: "💹",
  collecting: "🧺"
};

// Currently can afford 550 max
const PARTS = {
  "move": 50,
  "work": 100,
  "carry": 50,
  "attack": 80,
  "ranged_attack": 150,
  "heal": 250,
  "claim": 600,
  "tough": 10
};

// Body part templates
const BODY = {
  miner: [WORK, WORK, WORK, WORK, WORK, MOVE],  // 550 energy (10 energy/second)
  harvester: [CARRY, CARRY, CARRY, CARRY, WORK, MOVE, MOVE, MOVE, MOVE, MOVE],  // 550 energy
  builder: [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE],  // 550 energy
  upgrader: [WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE]  // 550 energy
};

// Visualization settings
const PATH_STYLE = {
  stroke: "#FFFF68",
  strokeWidth: 0.1,
  opacity: 0.2,
  lineStyle: "dashed"
};

module.exports.loop = function () {
  // Get all creeps and storage structures
  const creeps = room.find(FIND_MY_CREEPS);

  // Group creeps by role
  const miners = creeps.filter(creep => creep.memory.role === "miner");
  const harvesters = creeps.filter(creep => creep.memory.role === "harvester");
  const builders = creeps.filter(creep => creep.memory.role === "builder");

  // Get storage structures
  const storage = room.find(FIND_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_STORAGE ||
      s.structureType === STRUCTURE_CONTAINER
  });

  // Spawn new creeps if below population targets
  spawnCreepsIfNeeded(miners, harvesters, builders);

  // Assign miners to energy sources if needed
  assignMinersToSources(miners, energySources);

  // Process each creep's behavior
  for (let name in Game.creeps) {
    const creep = Game.creeps[name];

    // Handle mode transitions based on energy levels
    updateCreepMode(creep);

    // Execute behaviors based on current mode and role
    if (creep.memory.role === "miner") {
      runMiner(creep);
    } else {
      switch (creep.memory.mode) {
        case MODE.harvesting:
          harvestEnergy(creep, energySources, storage);
          break;
        case MODE.collecting:
          collectFromMiner(creep, miners);
          break;
        case MODE.storing:
          storeEnergy(creep, home, room, storage);
          break;
        case MODE.building:
          buildAndRepair(creep, room);
          break;
        case MODE.upgrading:
          upgradeController(creep, room);
          break;
      }
    }
  }

  // Clean up memory for dead creeps
  cleanupMemory();
};

function spawnCreepsIfNeeded(miners, harvesters, builders) {
  // First priority: miners (they produce the energy)
  if (miners.length < POPULATION.miner) {
    home.spawnCreep(
      BODY.miner,
      "Miner" + Game.time,
      { memory: { role: "miner", mode: MODE.mining, sourceId: null } }
    );
    return; // Only spawn one creep per tick
  }

  // Second priority: harvesters (they move the energy)
  if (harvesters.length < POPULATION.harvester) {
    home.spawnCreep(
      BODY.harvester,
      "Harvester" + Game.time,
      { memory: { role: "harvester", mode: MODE.idle } }
    );
    return;
  }

  // Last priority: builders (they use the energy)
  if (builders.length < POPULATION.builder) {
    home.spawnCreep(
      BODY.builder,
      "Builder" + Game.time,
      { memory: { role: "builder", mode: MODE.idle } }
    );
  }
}

function assignMinersToSources(miners, sources) {
  // Create an array to track which sources have miners
  const sourceHasMiner = Array(sources.length).fill(false);

  // Mark sources that already have miners assigned
  miners.forEach(miner => {
    if (miner.memory.sourceId) {
      // Find the index of this source in our sources array
      const sourceIndex = sources.findIndex(source => source.id === miner.memory.sourceId);
      if (sourceIndex >= 0) {
        sourceHasMiner[sourceIndex] = true;
      }
    }
  });

  // Assign unassigned miners to sources that need miners
  miners.forEach(miner => {
    if (!miner.memory.sourceId) {
      // Find first source without a miner
      const sourceIndex = sourceHasMiner.indexOf(false);
      if (sourceIndex >= 0) {
        miner.memory.sourceId = sources[sourceIndex].id;
        sourceHasMiner[sourceIndex] = true;
      }
    }
  });
}

function updateCreepMode(creep) {
  // Miners always stay in mining mode
  if (creep.memory.role === "miner") {
    creep.memory.mode = MODE.mining;
    return;
  }

  const energyFull = creep.store.energy === creep.store.getCapacity(RESOURCE_ENERGY);
  const energyEmpty = creep.store.energy === 0;

  // When creep is idle, decide what to do next
  if (creep.memory.mode === MODE.idle) {
    if (energyEmpty) {
      // Harvesters collect from miners, builders harvest directly
      if (creep.memory.role === "harvester") {
        creep.memory.mode = MODE.collecting;
      } else {
        creep.memory.mode = MODE.harvesting;
      }
    } else if (energyFull) {
      // Put energy to use based on role
      if (creep.memory.role === "harvester") {
        creep.memory.mode = MODE.storing;
      } else if (creep.memory.role === "builder") {
        creep.memory.mode = MODE.building;
      }
    }
  }

  // When creep finishes a task, go idle to reassess
  if ((creep.memory.mode === MODE.storing || creep.memory.mode === MODE.building) && energyEmpty) {
    creep.memory.mode = MODE.idle;
  }

  if ((creep.memory.mode === MODE.harvesting || creep.memory.mode === MODE.collecting) && energyFull) {
    creep.memory.mode = MODE.idle;
  }
}

function runMiner(creep) {
  // Miners just stay by their assigned source and mine continuously
  if (!creep.memory.sourceId) return;

  const source = Game.getObjectById(creep.memory.sourceId);
  if (!source) return;

  // If not in position, move to source
  if (creep.pos.getRangeTo(source) > 1) {
    creep.moveTo(source, { visualizePathStyle: PATH_STYLE });
    creep.say(MODE.mining + "🚶‍♂️📍");
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
      room.createConstructionSite(creep.pos, STRUCTURE_CONTAINER);
    }
  }

  // Mine the source
  creep.harvest(source);
  creep.say(MODE.mining);

  // Drop excess energy if inventory is getting full
  // This ensures continuous mining even when no harvesters are collecting
  if (creep.store.getFreeCapacity() < 20) {
    creep.drop(RESOURCE_ENERGY);
  }
}

function collectFromMiner(creep, miners) {
  // If no miners yet, fall back to direct harvesting
  if (miners.length === 0) {
    creep.memory.mode = MODE.harvesting;
    return;
  }

  // Display energy percentage
  const energyPercent = Math.floor((creep.store.energy / creep.store.getCapacity()) * 100);
  creep.say(MODE.collecting + energyPercent + "%");

  // Find the miner with the most energy
  let bestMiner = null;
  let bestScore = -1;

  for (const miner of miners) {
    // Score based on miner's energy and distance
    if (miner.store.energy > 0) {
      const distance = creep.pos.getRangeTo(miner);
      const score = miner.store.energy - (distance * 10); // Prioritize closer miners

      if (score > bestScore) {
        bestScore = score;
        bestMiner = miner;
      }
    }
  }

  // If no miners have energy, look for dropped energy near miners
  if (!bestMiner) {
    const droppedResources = [];

    // Check for dropped resources near each miner
    for (const miner of miners) {
      const resources = miner.pos.findInRange(FIND_DROPPED_RESOURCES, 1);
      droppedResources.push(...resources);
    }

    if (droppedResources.length > 0) {
      // Sort by amount
      droppedResources.sort((a, b) => b.amount - a.amount);

      // Pick up the largest pile
      if (creep.pickup(droppedResources[0]) === ERR_NOT_IN_RANGE) {
        creep.moveTo(droppedResources[0], { visualizePathStyle: PATH_STYLE });
        creep.say(MODE.collecting + "🚶‍♂️⚡");
      }
      return;
    }

    // If no dropped resources either, check for containers near miners
    const containers = [];
    for (const miner of miners) {
      const nearbyContainers = miner.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: s => s.structureType === STRUCTURE_CONTAINER &&
          s.store.getUsedCapacity(RESOURCE_ENERGY) > 0
      });
      containers.push(...nearbyContainers);
    }

    if (containers.length > 0) {
      // Sort by energy content
      containers.sort((a, b) =>
        b.store.getUsedCapacity(RESOURCE_ENERGY) -
        a.store.getUsedCapacity(RESOURCE_ENERGY)
      );

      // Withdraw from container with most energy
      if (creep.withdraw(containers[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(containers[0], { visualizePathStyle: PATH_STYLE });
        creep.say(MODE.collecting + "🚶‍♂️📦");
      }
      return;
    }

    // If still no energy found, fall back to direct harvesting
    creep.memory.mode = MODE.harvesting;
    return;
  }

  // Transfer energy from miner to harvester
  if (creep.pos.isNearTo(bestMiner)) {
    // If next to miner, request transfer
    bestMiner.transfer(creep, RESOURCE_ENERGY);
  } else {
    // Move to miner
    creep.moveTo(bestMiner, { visualizePathStyle: PATH_STYLE });
    creep.say(MODE.collecting + "🚶‍♂️⛏️");
  }
}

function harvestEnergy(creep, energySources, storage) {
  // This is used as a fallback when miners aren't available
  // Display energy percentage
  const energyPercent = Math.floor((creep.store.energy / creep.store.getCapacity()) * 100);
  creep.say(creep.memory.mode + energyPercent + "%");

  if (creep.memory.role === "builder") {
    // Builders first try to get energy from storage
    if (storage.length > 0) {
      // Sort by energy content (most first)
      storage.sort((a, b) =>
        b.store.getUsedCapacity(RESOURCE_ENERGY) -
        a.store.getUsedCapacity(RESOURCE_ENERGY)
      );

      if (storage[0].store.getUsedCapacity(RESOURCE_ENERGY) > 50) {
        if (creep.withdraw(storage[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(storage[0], { visualizePathStyle: PATH_STYLE });
          creep.say(creep.memory.mode + "🚶‍♂️📦");
          return;
        }
      }
    }

    // If no storage with energy, harvest directly
    const source = energySources[0]; // Default to first source
    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
      creep.moveTo(source, { visualizePathStyle: PATH_STYLE });
      creep.say(creep.memory.mode + "🚶‍♂️📍");
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

  creep.say(creep.memory.mode + message)

  // Move to target and transfer energy
  if (target !== controller) {
    if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, { visualizePathStyle: PATH_STYLE });
    } 
  } else {
    if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
      creep.moveTo(controller, { visualizePathStyle: PATH_STYLE });
    }
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

  // Prioritize containers near miners
  const minerContainers = [];
  const creeps = room.find(FIND_MY_CREEPS);
  const miners = creeps.filter(creep => creep.memory.role === "miner");

  for (const miner of miners) {
    const sites = miner.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
      filter: site => site.structureType === STRUCTURE_CONTAINER
    });
    minerContainers.push(...sites);
  }

  // Priority: 1. Construction, 2. Repair
  if (constructions.length > 0) {
    if (creep.build(constructions[0]) === ERR_NOT_IN_RANGE) {
      creep.moveTo(constructions[0], { visualizePathStyle: PATH_STYLE });
      creep.say(creep.memory.mode + "🚶‍♂️📍");
    }
  } else if (damagedStructures.length > 0) {
    if (creep.repair(damagedStructures[0]) === ERR_NOT_IN_RANGE) {
      creep.moveTo(damagedStructures[0], { visualizePathStyle: PATH_STYLE });
      creep.say(creep.memory.mode + "🚶‍♂️🔧");
    }
  } else if (minerContainers.length > 0) {
    // Build miner containers first for better energy flow
    if (creep.build(minerContainers[0]) === ERR_NOT_IN_RANGE) {
      creep.moveTo(minerContainers[0], { visualizePathStyle: PATH_STYLE });
      creep.say(creep.memory.mode + "🚶‍♂️📦");
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