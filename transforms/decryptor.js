const crypto = require('crypto');
const fs = require('fs');
const stream = require('stream');

class Decryptor extends stream.Transform {
    constructor() {
        super();

        const key_text = fs.readFileSync('./transforms/arbos-private-key').toString();

        this.key_text = '86753098675309gt';
    }

    _transform(chunk, _, next) {
        console.log('Received');
        console.log(chunk);
        const authTag = chunk.subarray(-16);
        const content = chunk.subarray(0, -16);

        const decryptor = crypto.createDecipheriv('aes-128-gcm', this.key_text, 'flip');
        let result = Buffer.alloc(0);

        decryptor.setAuthTag(authTag);

        decryptor.on('error', err => {
            console.error('Error in Decryptor');
            console.error(err);
            next();
        });

        decryptor.on('data', tt => {
            result = Buffer.concat([result, tt]);
        });

        decryptor.on('end', () => {
            this.push(result);
            next();
        });

        decryptor.write(content);
        decryptor.end();
    }
}

module.exports = Decryptor;
