class ArbosConfig {
    /**
     *
     * @param {object} raw
     * @param {string[]} raw.radio_proc
     */
    constructor(raw) {
        this.radio_proc = raw.radio_proc;
    }
}

module.exports = ArbosConfig;
