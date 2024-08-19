const { Transform } = require('stream');
const zlib = require('zlib');

class BrotliCompressor extends Transform {
    constructor() {
        super({ writableObjectMode: true });
    }

    _transform(uncompressed, _, next) {
        const full_string = typeof uncompressed === 'string' ? uncompressed : JSON.stringify(uncompressed);

        zlib.brotliCompress(full_string, (err, result) => {
            try {
                if (err) {
                    throw err;
                }

                this.push(result);
            } catch (err) {
                // TODO: How to handle errors onboard
            } finally {
                next();
            }
        });
    }
}

module.exports = BrotliCompressor;
