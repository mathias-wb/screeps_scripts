module.exports = {
    /**
     * Clean up memory entries for creeps that no longer exist
     */
    cleanupMemory: function() {
        for (let name in Memory.creeps) {
            if (!Game.creeps[name]) {
                delete Memory.creeps[name];
            }
        }
    }
};