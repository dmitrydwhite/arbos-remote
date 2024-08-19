const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const stream = require('stream');
const { ERROR, DONE, DATA, ACK, NACK } = require('./message-types');

const NACK_GIVEUP = 4;
const NACK_WAIT = 10000;

class ReceiveChannel extends stream.Duplex {
    static TASK_COMPLETE = 'ReceiveChannel.TASK_COMPLETE';

    /**
     * @param {number} channel_id
     * @param {string} hash
     * @param {number} expected_chunks
     * @param {string} local_storage_path
     */
    constructor(channel_id, hash, expected_chunks, local_storage_path) {
        super({ readableObjectMode: true, writableObjectMode: true });
        this.channel_id = channel_id;
        this.expected_hash = hash;
        this.expected_chunks = expected_chunks;

        this.mem_map = new Map();
        this.hash = crypto.createHash('MD5');
        this.write_stream = fs.createWriteStream(local_storage_path);
        this.next_to_write = 0;
        this.nack_count = 0;
        this.receive_timer = null;

        this.push([this.channel_id, NACK, this.expected_hash, this.next_to_write, this.expected_chunks]);

        this.reset_receive_timer();
    }

    _read() {}

    cleanup_and_report_done() {
        console.log('this is a thing that is happening');
    }

    reset_receive_timer() {
        if (this.receive_timer) {
            clearTimeout(this.receive_timer);
        }

        if (this.nack_count > NACK_GIVEUP) {
            this.push([this.channel_id, ERROR, `Channel ${this.channel_id} exceeded NACK retries`]);
            this.emit(ReceiveChannel.TASK_COMPLETE);

            return;
        }

        this.receive_timer = setTimeout(() => {
            this.check_for_and_report_missing_chunks();
        }, NACK_WAIT);
    }

    validate_hash_and_resolve() {
        const computed_hash = this.hash.digest('hex');

        if (computed_hash === this.expected_hash) {
            this.push([this.channel_id, ACK, computed_hash]);

        } else {
            this.push([this.channel_id, ERROR, `Hash mismatch: expected ${this.expected_hash} but calculated ${computed_hash}`]);
        }

        this.emit(ReceiveChannel.TASK_COMPLETE);
    }

    check_for_and_report_missing_chunks() {
        const all_missing = [];

        for (let i = this.next_to_write; i < this.expected_chunks; i += 1) {
            if (!this.mem_map.get(i)) {
                all_missing.push(i);
            }
        }

        if (!all_missing.length) {
            this.validate_hash_and_resolve();
        }

        const missing_pairs = [];
        let start_idx = null;
        let stop_idx = null;

        all_missing.forEach(missing_idx => {
            if (start_idx === null) {
                start_idx = missing_idx;
                stop_idx = missing_idx + 1;

                return;
            }

            if (missing_idx !== stop_idx) {
                missing_pairs.push(start_idx, stop_idx);
                start_idx = missing_idx;
                stop_idx = missing_idx + 1;

                return;
            }

            stop_idx += 1;
        });

        missing_pairs.push(start_idx, stop_idx);

        this.nack_count += 1;
        this.push([this.channel_id, NACK, this.expected_hash, ...missing_pairs]);
        this.reset_receive_timer();
    }

    /**
     * @param {number} index
     */
    attempt_to_write(index) {
        const buf = this.mem_map.get(index);

        if (buf && index === this.next_to_write) {
            this.hash.update(buf);
            this.write_stream.write(buf, err => {
                if (err) {
                    console.error(`Index: ${index}`);
                    console.error(`Error in receive channel ${this.channel_id} trying to write to file`);
                    console.error(err);

                    return;
                }

                this.next_to_write += 1;
                this.attempt_to_write(this.next_to_write);
            });
        }
    }

    /**
     * @param {number} index
     * @param {number[]} data_arr
     */
    store_at_index(index, data_arr) {
        const buf = Buffer.from(data_arr);

        this.mem_map.set(index, buf);

        this.attempt_to_write(index);
    }

    /**
     * @param {any[]} msg
     * @param {*} _
     * @param {(err?) => void} next
     */
    _write(msg, _, next) {
        const channel_id = msg.shift();

        if (channel_id !== this.channel_id) {
            console.error(`Misdirected message: channel ${this.channel_id} received a message for channel ${channel_id}`);
            console.error(msg);

            return next();
        }

        const command = msg.shift();

        if (command === DONE) {
            return this.check_for_and_report_missing_chunks()
                .then(() => {
                    next();
                });
        }

        if (command === DATA) {
            msg.shift();

            const [index, ...data] = msg;

            this.nack_count = 0;
            this.store_at_index(index, data);
            this.reset_receive_timer();
            next();
        }

        console.error('This is unexpected');
        next();
    }

    _destroy(done) {
        this.cleanup_and_report_done();
        done();
    }
}

module.exports = ReceiveChannel;
