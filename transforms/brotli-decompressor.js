const { Transform } = require('stream');
const zlib = require('zlib');

class BrotliDecompressor extends Transform {
    _transform(compressed, _, next) {
        zlib.brotliDecompress(compressed, (err, result) => {
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

module.exports = BrotliDecompressor;
