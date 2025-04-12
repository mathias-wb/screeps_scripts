home = Game.spawns["Home"]
room = Game.rooms["E15N11"]
controller = home.room.controller

creepCount = {
    "harvester": 5,
    "builder": 2
}

module.exports.loop = function () {
    creeps = room.find(FIND_MY_CREEPS)
    const harvesterCreeps = _.filter(creeps, (creep) => {return creep.memory.role === "harvester"});
    const builderCreeps = _.filter(creeps, (creep) => {return creep.memory.role === "builder"});


    if (harvesterCreeps < creepCount["harvester"]) {
        home.spawnCreep([WORK, CARRY, MOVE], "Harvester".concat(Game.time), {memory: {role: "harvester", mode: "💤"}})
    }
    if (builderCreeps < creepCount["builder"]) {
        home.spawnCreep([WORK, CARRY, MOVE], "Builder".concat(Game.time), {memory: {role: "builder", mode: "💤"}})
    }
    
    for (let name in Game.creeps) {
        let creep = Game.creeps[name]

        if (creep.memory.role == "harvester") {
            // checks whether creep is idle, and assigns it a task to be done until completion
            if (creep.memory.mode == "💤") {
                if (creep.store.energy < creep.store.getCapacity(RESOURCE_ENERGY)) {
                    creep.memory.mode = "⚡️"  // harvest energy
                } else if (creep.store.energy == creep.store.getCapacity(RESOURCE_ENERGY)) {
                    creep.memory.mode = "🔋"  // store energy
                }
            }

            if (creep.memory.mode == "⚡️") {
                creep.say(creep.memory.mode.concat(creep.store.energy, "/", creep.store.getCapacity()))
                if (creep.store.energy < creep.store.getCapacity(RESOURCE_ENERGY)) {
                    energy_source = room.find(FIND_SOURCES)[0]
                    if (creep.harvest(energy_source, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(energy_source);
                        creep.say(creep.memory.mode.concat("🚶‍♂️📍"))
                    }
                } else {
                    creep.memory.mode = "💤"
                }
            }

            if (creep.memory.mode == "🔋") {
                creep.say(creep.memory.mode.concat(creep.store.energy, "/", creep.store.getCapacity()))
                if (home.store[RESOURCE_ENERGY] < home.store.getCapacity(RESOURCE_ENERGY)) {
                    if (creep.transfer(home, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(home);
                        creep.say(creep.memory.mode.concat("🚶‍♂️🏡"))
                    }
                } else {
                    if (creep.transfer(controller, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(controller);
                        creep.say(creep.memory.mode.concat("🚶‍♂️🎮"))
                    }
                }

                if (creep.store[RESOURCE_ENERGY] == 0) {
                    creep.memory.mode = "💤"
                }
            }
        }

        if (creep.role == "builder") {
            if (creep.memory.mode == "💤") {
                if (creep.store.energy < creep.store.getCapacity(RESOURCE_ENERGY)) {
                    creep.memory.mode = "⚡️"  // harvest energy
                } else if (creep.store.energy == creep.store.getCapacity(RESOURCE_ENERGY)) {
                    creep.memory.mode = "🚧"  // construct something
                }
            }
        }
    }

    for(let i in Memory.creeps) {
        if(!Game.creeps[i]) {
            delete Memory.creeps[i];
        }
    }

}