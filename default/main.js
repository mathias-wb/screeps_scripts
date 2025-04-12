const home = Game.spawns["Home"]
const room = Game.rooms["E15N11"]
const controller = home.room.controller

const creepCount = {
    "harvester": 3,
    "builder": 1
}


module.exports.loop = function () {
    creeps = room.find(FIND_MY_CREEPS)

    // lists of creeps by role
    var harvesterCreeps = _.filter(creeps, (creep) => {return creep.memory.role === "harvester"});
    var builderCreeps = _.filter(creeps, (creep) => {return creep.memory.role === "builder"});

    // compare creeps with quotas, spawn more if missing
    if (harvesterCreeps.length < creepCount["harvester"]) {
        home.spawnCreep([WORK, CARRY, MOVE], "Harvester".concat(Game.time), {memory: {role: "harvester", mode: "💤"}})
    }
    if (builderCreeps.length < creepCount["builder"]) {
        home.spawnCreep([WORK, CARRY, MOVE], "Builder".concat(Game.time), {memory: {role: "builder", mode: "💤"}})
    }
    

    for (let name in Game.creeps) {
        let creep = Game.creeps[name]

        // idle creeps
        if (creep.memory.mode == "💤") {
            if (creep.store.energy < creep.store.getCapacity(RESOURCE_ENERGY)) {
                creep.memory.mode = "⚡️"  // harvest energy
            } else {
                creep.say("💤")
            }
        }

        // harvesters with full energy storage
        if (creep.memory.role == "harvester" && creep.store.energy == creep.store.getCapacity(RESOURCE_ENERGY)) {
            creep.memory.mode = "🔋"  // store energy
        }

        // builders with full energy storage
        if (creep.memory.role == "builder" && creep.store.energy == creep.store.getCapacity(RESOURCE_ENERGY)) {
            creep.memory.mode = "🚧"  // construct something
        }

        // harvesting energy from source
        if (creep.memory.mode == "⚡️") {
            creep.say(creep.memory.mode.concat(Math.floor((creep.store.energy / creep.store.getCapacity())*100), "%"))
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

        // filling up energy storage
        if (creep.memory.mode == "🔋") {
            creep.say(creep.memory.mode.concat(Math.floor((creep.store.energy / creep.store.getCapacity())*100), "%"))
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

        // building constructions
        if (creep.memory.mode == "🚧") {
            creep.say(creep.memory.mode.concat(Math.floor((creep.store.energy / creep.store.getCapacity())*100), "%"))
            let construction = room.find(FIND_MY_CONSTRUCTION_SITES)[0]
            if (creep.build(construction, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                creep.moveTo(construction);
                creep.say(creep.memory.mode.concat("🚶‍♂️📍"))
            }

            if (creep.store[RESOURCE_ENERGY] == 0) {
                creep.memory.mode = "💤"
            }
        }
    }

    for(let i in Memory.creeps) {
        if(!Game.creeps[i]) {
            delete Memory.creeps[i];
        }
    }

}