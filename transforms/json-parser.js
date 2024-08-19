const stream = require('stream');

class JSONParser extends stream.Transform {
    constructor() {
        super({ readableObjectMode: true });
    }

    _transform(chunk, _, next) {
        const buf_str = chunk.toString();

        try {
            this.push(JSON.parse(buf_str));
            next();
        } catch (err) {
            console.error('Error in JSONParser');
            console.error(err);
            next();
        }
    }
}

module.exports = JSONParser;
