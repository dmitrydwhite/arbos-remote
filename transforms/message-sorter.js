const stream = require('stream');

class MessageSorter extends stream.Transform {
    constructor() {
        super({ readableObjectMode: true, writableObjectMode: true });
    }

    _transform(chunk, _, next) {
        if (Array.isArray(chunk)) {
            this.push(['f', chunk]);
        } else {
            this.push(['t', chunk]);
        }

        next();
    }
}

module.exports = MessageSorter;
