const crypto = require('crypto');
const fs = require('fs');
const stream = require('stream');

class Encryptor extends stream.Transform {
    constructor() {
        super();

        this.key_text = '86753098675309gt';
    }

    _transform(chunk, _, next) {
        try {
            const encryptor = crypto.createCipheriv('aes-128-gcm', this.key_text, 'flip');
            const encrypted = Buffer.concat([encryptor.update(chunk), encryptor.final()]);
            const authTag = encryptor.getAuthTag();

            this.push(Buffer.concat([encrypted, authTag]));
        } catch (err) {
            console.error('Error in Encryptor');
            console.error(err);
        } finally {
            next();
        }
    }
}

module.exports = Encryptor;
