const stream = require('stream');
const { FESC, FEND, TFEND, TFESC } = require('./arbos-kiss-constants');

class ArbosKISSDecoder extends stream.Transform {
    constructor() {
        super();

        /**
         * @type {Map<number, (Buffer | null)[]>}
         */
        this.oversize_map = new Map();

        /**
         * @type {Buffer}
         */
        this.partial_frame = Buffer.alloc(0);
    }

    /**
     * @param {Buffer} buf
     */
    extract_message_from_frame(buf) {
        const msg_arr = [];
        const inc_bytes = buf.subarray(1, 3);
        const inc_val = inc_bytes.readUInt16BE();
        const message_id = inc_val >> 6;
        const message_seq = (inc_val & 56) >> 3;
        const message_max = inc_val & 7;
        const last_byte = buf.length - 1;
        let decode_idx = 3;

        // Check that this is a complete frame bookended by FEND characters
        if (buf[0] !== FEND || buf[last_byte] !== FEND) {
            throw new Error('Won\'t extract from middle or partial frame');
        }

        // Unescape any escaped bytes
        while (decode_idx < last_byte) {
            const char = buf[decode_idx];

            if (char !== FESC) {
                msg_arr.push(char);
                decode_idx += 1;
            } else {
                const escaped = buf[decode_idx + 1];

                if (escaped === TFEND) {
                    msg_arr.push(FEND);
                } else if (escaped === TFESC) {
                    msg_arr.push(FESC);
                } else {
                    msg_arr.push(char, escaped);
                }

                decode_idx += 2;
            }
        }

        // If this message is not one of a group of messages, push it along.
        if (inc_val === 0) {
            this.push(Buffer.from(msg_arr));

            return;
        }

        // Otherwise, find or create the array for this message.
        const os_map = this.oversize_map.get(message_id) || [...Array(message_max)].map(() => null);

        // This could happen if we got two messages with the same id but indicating different max segments count.
        if (os_map.length !== message_max) {
            throw new Error(
                `Malformed multipart message received; conflicting segment count for message ${message_id} got ${os_map.length} and ${message_max}`
            );
        }

        // Insert the current frame into the Map at the indicated position:
        os_map[message_seq] = Buffer.from(msg_arr);

        // If we have not received all the segments, update the Map and return.
        if (os_map.find(x => x === null)) {
            this.oversize_map.set(message_id, os_map);

            return;
        }

        // If all segments are in the Map, combine and push them, then delete the Map entry.
        this.push(Buffer.concat(os_map));
        this.oversize_map.delete(message_id);
    }

    /**
     * @param {Buffer} buf
     * @returns {[(Buffer | null), Buffer]}
     */
    pop_frame(buf) {
        if (buf.length <= 3) {
            return [null, buf];
        }

        let ptr = 3;

        // These two operations trim off any unframed data, and advance past mutiple FENDs in a row.
        while (buf[0] !== FEND && buf.length) {
            buf = buf.subarray(1);
        }

        while (buf[1] === FEND && buf.length) {
            buf = buf.subarray(1);
        }

        let char = buf[ptr];

        while (char !== FEND && ptr < buf.length) {
            ptr += 1;
            char = buf[ptr];
        }

        if (char !== FEND) {
            return [null, buf];
        }

        return [buf.subarray(0, ptr + 1), buf.subarray(ptr + 1)];
    }

    _transform(chunk, _, next) {
        const working_buffer = Buffer.concat([this.partial_frame, chunk]);
        let [frame, rest] = this.pop_frame(working_buffer);

        while (frame) {
            const next_parse = this.pop_frame(rest);

            this.extract_message_from_frame(frame);
            frame = next_parse[0];
            rest = next_parse[1];
        }

        this.partial_frame = rest;

        next();
    }
}

module.exports = ArbosKISSDecoder;
