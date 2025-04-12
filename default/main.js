const home = Game.spawns["Home"];
const room = Game.rooms["E15N11"];
const controller = home.room.controller;
const energy_sources = room.find(FIND_SOURCES);

const creepCount = {
    "harvester": 4,
    "builder": 1
}

module.exports.loop = function () {
    creeps = room.find(FIND_MY_CREEPS);

    // lists of creeps by role
    var harvesterCreeps = _.filter(creeps, (creep) => {return creep.memory.role === "harvester"});
    var builderCreeps = _.filter(creeps, (creep) => {return creep.memory.role === "builder"});

    // compare creeps with quotas, spawn more if missing
    if (harvesterCreeps.length < creepCount["harvester"]) {
        home.spawnCreep([WORK, CARRY, MOVE], "Harvester".concat(Game.time), {memory: {role: "harvester", mode: "💤"}});
    }
    if (builderCreeps.length < creepCount["builder"]) {
        home.spawnCreep([WORK, CARRY, MOVE], "Builder".concat(Game.time), {memory: {role: "builder", mode: "💤"}});
    }
    

    for (let name in Game.creeps) {
        let creep = Game.creeps[name];

        // idle creeps
        if (creep.memory.mode == "💤") {
            if (creep.store.energy < creep.store.getCapacity(RESOURCE_ENERGY)) {
                creep.memory.mode = "⚡️";  // harvest energy
            } else {
                creep.say("💤");
            }
        }

        // harvesters with full energy storage
        if (creep.memory.role == "harvester" && creep.store.energy == creep.store.getCapacity(RESOURCE_ENERGY)) {
            creep.memory.mode = "🔋";  // store energy
        }

        // builders with full energy storage
        if (creep.memory.role == "builder" && creep.store.energy == creep.store.getCapacity(RESOURCE_ENERGY)) {
            creep.memory.mode = "🚧";  // construct something
        }

        // harvesting energy from source
        if (creep.memory.mode == "⚡️") {
            creep.say(creep.memory.mode.concat(Math.floor((creep.store.energy / creep.store.getCapacity())*100), "%"));
            if (creep.store.energy < creep.store.getCapacity(RESOURCE_ENERGY)) {
                if (creep.harvest(energy_sources[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(energy_sources[0]);
                    creep.say(creep.memory.mode.concat("🚶‍♂️📍"));
                }
            } else {
                creep.memory.mode = "💤";
            }
        }

        // filling up energy storage
        if (creep.memory.mode == "🔋") {
            creep.say(creep.memory.mode.concat(Math.floor((creep.store.energy / creep.store.getCapacity())*100), "%"));
            var extensions = room.find(FIND_STRUCTURES, {
                filter: (s) => s.structureType === STRUCTURE_EXTENSION
            });
            var emptyExtensions = extensions.filter(ext => ext.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
            if (home.store[RESOURCE_ENERGY] < home.store.getCapacity(RESOURCE_ENERGY)) {
                if (creep.transfer(home, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(home,{
                        visualizePathStyle: {
                            stroke: "#FFFF68",
                            strokeWidth: 0.1,
                            opacity: 0.2,
                            lineStyle: "dashed" // or 'solid'
                        }
                    });
                    creep.say(creep.memory.mode.concat("🚶‍♂️🏡"));
                }

            // filling up empty extensions
            } else if (emptyExtensions.length > 0) {
                if (creep.transfer(emptyExtensions[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(emptyExtensions[0],{
                        visualizePathStyle: {
                            stroke: "#FFFF68",
                            strokeWidth: 0.1,
                            opacity: 0.2,
                            lineStyle: "dashed" // or 'solid'
                        }
                    });
                    creep.say(creep.memory.mode.concat("🚶‍♂️🎮"));
                }

            } else {
                if (creep.transfer(controller, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(controller,{
                        visualizePathStyle: {
                            stroke: "#FFFF68",
                            strokeWidth: 0.1,
                            opacity: 0.2,
                            lineStyle: "dashed" // or 'solid'
                        }
                    });
                    creep.say(creep.memory.mode.concat("🚶‍♂️🎮"));
                }
            }

            if (creep.store[RESOURCE_ENERGY] == 0) {
                creep.memory.mode = "💤";
            }
        }

        // building constructions
        if (creep.memory.mode == "🚧") {
            creep.say(creep.memory.mode.concat(Math.floor((creep.store.energy / creep.store.getCapacity())*100), "%"));
            let construction = room.find(FIND_MY_CONSTRUCTION_SITES)[0];
            if (creep.build(construction, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                creep.moveTo(construction,{
                    visualizePathStyle: {
                        stroke: "#FFFF68",
                        strokeWidth: 0.1,
                        opacity: 0.2,
                        lineStyle: "dashed" // or 'solid'
                    }
                });
                creep.say(creep.memory.mode.concat("🚶‍♂️📍"));
            }

            if (creep.store[RESOURCE_ENERGY] == 0) {
                creep.memory.mode = "💤";
            }
        }
    }

    for(let i in Memory.creeps) {
        if(!Game.creeps[i]) {
            delete Memory.creeps[i];
        }
    }

}