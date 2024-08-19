const fs = require('fs');
const path = require('path');
const stream = require('stream');
const FilePreparer = require('./file-preparer');
const { READY, ERROR, DONE, DATA } = require('./message-types');

const NACK_GIVEUP = 10;
const NACK_TIMEOUT = 60000;

class SendChannel extends stream.Duplex {
    static FILE_MESSAGE = 'SendChannel.FILE_MESSAGE';
    static TASK_COMPLETE = 'SendChannel.TASK_COMPLETE';

    constructor(channel_id, local_path) {
        super({ writableObjectMode: true, readableObjectMode: true });

        this.channel_id = channel_id;
        this.local_path = local_path;
        this.storage_path = null;
        this.nack_timeout = null;
        this.nack_counter = 0;

        this.locate_and_prepare_file();
    }

    _read() {}

    reset_nack_timeout() {
        this.nack_counter += 1;

        clearTimeout(this.nack_timeout);

        if (this.nack_counter > NACK_GIVEUP) {
            this.push([this.channel_id, ERROR, `Got too many NACK messages to continue`]);
            this.emit(SendChannel.TASK_COMPLETE);

            return;
        }

        this.nack_timeout = setTimeout(() => {
            console.error(`Channel ${this.channel_id} send timed out.`);
            this.push([this.channel_id, ERROR, `No response received within timeout window`]);
            this.emit(SendChannel.TASK_COMPLETE);
        }, NACK_TIMEOUT);
    }

    locate_and_prepare_file() {
        if (!fs.existsSync(this.local_path)) {
            this.push([this.channel_id, 6, `Invalid path on local: ${this.local_path}`]);

            return next();
        }

        const file_read = fs.createReadStream(this.local_path).pipe(new FilePreparer());

        file_read.on(FilePreparer.STORAGE_FINISHED, ({ storage_path, num_chunks }) => {
            this.storage_path = storage_path;
            this.file_hash = storage_path.split(path.sep).pop();

            this.push([this.channel_id, READY, this.file_hash, num_chunks]);

            this.reset_nack_timeout();
        });
    }

    /**
     * @param {number} file_index
     * @returns {Promise<void>}
     */
    send_file_chunk_p(file_index) {
        return new Promise((resolve, reject) => {
            fs.readFile(path.join(this.storage_path, file_index), (err, data) => {
                if (err) {
                    return reject(err);
                }

                this.push([this.channel_id, DATA, this.file_hash, file_index, ...Array.from(data)]);
                resolve();
            });
        });
    }

    /**
     *
     * @param {number[]} missing_pairs
     */
    send_requested_chunks(missing_pairs) {
        const missing = [];

        if (missing_pairs.length % 2 !== 0) {
            return this.push([this.channel_id, ERROR, `Malformed NACK message received; odd number of missing pairs`]);
        }

        while (missing_pairs.length) {
            let [first, stop] = missing_pairs;

            while (first < stop) {
                missing.push(first);
                first += 1;
            }

            missing_pairs = missing_pairs.slice(2);
        }

        Promise
            .all(missing.map(chunk_index => this.send_file_chunk_p(chunk_index)))
            .then(() => {
                this.push([this.channel_id, DONE, this.file_hash]);
                this.reset_nack_timeout();
            });
    }

    _write(msg, _, next) {
        const [channel_id, command, __, ...missing_pairs] = msg;

        if (channel_id !== this.channel_id) {
            console.error(`Misdirected message: channel ${this.channel_id} received a message for channel ${channel_id}`);
            console.error(msg);

            return next();
        }

        if (command === 0) {
            // We are done, emit the event that our task is complete
            this.emit(SendChannel.TASK_COMPLETE);

            return next();
        }

        if (command === 7) {
            // Figure out which chunks are missing and send them
            this.send_requested_chunks(missing_pairs);

            return next();
        }

        // We have received an unexpected message
        console.error(`Unexpected file message on channel ${this.channel_id}: Expected 0 or 7 but got ${command}`);

        return next();
    }
}

module.exports = SendChannel;
