// Creep utility functions
const config = require('config');

module.exports = {
    /**
     * Get energy percentage stored in creep
     * @param {Creep} creep - The creep to check
     * @returns {number} Percentage of energy capacity filled
     */
    getEnergyPercent: function(creep) {
        var percentage = Math.floor((creep.store.energy / creep.store.getCapacity()) * 100);
        if (percentage == 0) {
            return "💔";
        } else if (percentage <= 20) {
            return "🖤";
        } else if (percentage <= 40) {
            return "🧡";
        } else if (percentage <= 60) {
            return "💛";
        } else if (percentage <= 80) {
            return "💚";
        } else {
            return "🤍"
        }
    },
    
    /**
     * Make creep say its current mode and energy percentage
     * @param {Creep} creep - The creep that should speak
     * @param {boolean} moving - Whether the creep is moving (adds walking emoji)
     */
    say: function(creep, moving = false) {
        let message = creep.memory.mode;
        
        // Add energy percentage for relevant modes
        if (creep.memory.mode === config.MODE.harvesting || 
            creep.memory.mode === config.MODE.collecting ||
            creep.memory.mode === config.MODE.storing ||
            creep.memory.mode === config.MODE.building ||
            creep.memory.mode === config.MODE.upgrading ||
            creep.memory.mode === config.MODE.exploring) {
            message += this.getEnergyPercent(creep);
        }
        
        // Add walking emoji if moving
        if (moving) {
            message = "🚶‍♂️" + message;
        }
        
        creep.say(message);
    },
    
    /**
     * Move creep to target with visualization
     * @param {Creep} creep - The creep to move
     * @param {RoomObject} target - The target to move to
     */
    moveTo: function(creep, target) {
        creep.moveTo(target, { visualizePathStyle: config.PATH_STYLE });
        this.say(creep, true);
    }
};