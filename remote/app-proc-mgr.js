const os = require('os');
const stream = require('stream');

class ApplicationProcessMgr extends stream.Duplex {
    constructor() {
        super();

        const par = (Object.keys(os).includes('availableParallelism') ? os.availableParallelism() : os.cpus().length) / 2;

        this.avail_par = par;
        this.cmd_q = new stream.PassThrough();
    }

    _write(chunk, _, next) {
        console.log(chunk);
        next();
    }

    _read() { /* Empty */ }
}

module.exports = ApplicationProcessMgr;
