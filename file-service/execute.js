const { Transform } = require('stream');
const Service = require('./service');

var FS = new Service();
var toArray = new Transform({
    readableObjectMode: true,
    transform(chunk, _, next) {
        const msg = chunk.toString().split(',').map(x => x.trim());
        msg[0] = Number(msg[0]);
        msg[1] = Number(msg[1]);
        this.push(msg);
        next();
    }
});
var toStr = new Transform({
    writableObjectMode: true,
    transform(chunk, _, next) {
        const line = JSON.stringify(chunk);
        this.push(line + '\n');
        next();
    }
})

FS.pipe(toStr).pipe(process.stdout);

process.stdin.pipe(toArray).pipe(FS);