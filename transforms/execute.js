const crypto = require('crypto');
const stream = require('stream');
const Encryptor = require('./encryptor');
const Decryptor = require('./decryptor');

const logger = new stream.Writable({
    write(chunk, _, next) {
        console.log('got decrypted');
        console.log(chunk.toString());
        next();
    }
});

const en = new Encryptor();
const de = new Decryptor();

process.stdin.pipe(en).pipe(de).pipe(logger);