const stream = require('stream');
const BrotliDecompressor = require('../transforms/brotli-decompressor');
const BrotliCompressor = require('../transforms/brotli-compressor');
const Decryptor = require('../transforms/decryptor');
const Encryptor = require('../transforms/encryptor');
const JSONParser = require('../transforms/json-parser');
const JSONStringifier = require('../transforms/json-stringifier');
const ArbosKISSEncoder = require('../transforms/arbos-kiss-encoder');
const ArbosKISSDecoder = require('../transforms/arbos-kiss-decoder');
const MessageSorter = require('../transforms/message-sorter');
const FileService = require('../file-service/service');

class CommConnection extends stream.Duplex {
    /**
     *
     * @param {object} param0
     * @param {FileService} param0.file_service
     * @param {stream.Writable} param0.received
     * @param {stream.Readable} param0.downlink
     */
    constructor({ file_service, received, downlink }) {
        super();

        // Here are the streams for receiving data
        const kissDecoder = new ArbosKISSDecoder();
        const decryptor = new Decryptor();
        const brotliInflator = new BrotliDecompressor();
        const jsonParser = new JSONParser();
        const splitter = new MessageSorter();

        // Here are the streams for sending data
        const jsonStringer = new JSONStringifier();
        const brotliCompressor = new BrotliCompressor();
        const encryptor = new Encryptor();
        const kissEncoder = new ArbosKISSEncoder();

        // Construct the paths
        const receive_path = kissDecoder.pipe(decryptor).pipe(brotliInflator).pipe(jsonParser).pipe(splitter);
        const send_path = jsonStringer.pipe(brotliCompressor).pipe(encryptor).pipe(kissEncoder);

        // Monitor the receive path
        receive_path.on('data', ([type, data]) => {
            switch (type) {
                case 'f':
                    file_service.write(data);
                    return;
                case 't':
                    received.write(data);
                    return;
                default:
                    console.error(`Something went wrong with the splitter: expected f or t but got ${type}`);
            }
        });

        send_path.on('data', data => {
            this.push(data);
        });

        // Pipe messages received from the file service and infrastructure manager to the outbound stream
        file_service.pipe(jsonStringer);
        downlink.pipe(jsonStringer);

        // Expose a passthrough for data written to this class
        this.receiver = new stream.PassThrough();
        this.receiver.pipe(kissDecoder);
    }

    _read() { /* Empty */ }

    _write(chunk, _, next) {
        this.receiver.write(chunk);
        next();
    }
}

module.exports = CommConnection;
