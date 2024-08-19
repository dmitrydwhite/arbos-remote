const stream = require('stream');

class JSONStringifier extends stream.Transform {
    constructor() {
        super({ writableObjectMode: true });
    }

    _transform(chunk, _, next) {
        this.push(JSON.stringify(chunk));
        next();
    }
}

module.exports = JSONStringifier;
