const stream = require('stream');
const { MAX_SIZE, OVERSIZE_MAX, FESC, FEND, TFEND, TFESC } = require('./arbos-kiss-constants');

class ArbosKISSEncoder extends stream.Transform {
    constructor() {
        super();
        this.oversize = 1;
    }

    /**
     * @param {Buffer} buf
     */
    escape(buf) {
        const escaped = [];

        for(let i = 0; i < buf.length; i++) {
            const elem = buf[i];

            switch (elem) {
                case FEND:
                    escaped.push(FESC, TFEND);
                    continue;
                case FESC:
                    escaped.push(FESC, TFESC);
                    continue;
                default:
                    escaped.push(elem);
            }
        }

        return Buffer.from(escaped);
    }

    /**
     * @param {number} lead_value
     * @param {Buffer} buf
     */
    frame(lead_value, buf) {
        const inc_bytes = Buffer.alloc(2);

        inc_bytes.writeUInt16BE(lead_value);

        return Buffer.concat([
            Buffer.alloc(1, FEND),
            inc_bytes,
            buf,
            Buffer.alloc(1, FEND),
        ]);
    }

    /**
     * @param {Buffer} chunk
     */
    push_multi(chunk) {
        const oversize_count = this.oversize << 6;
        const segments = Math.floor(chunk.length / MAX_SIZE) ;
        let segment = 0;

        while (chunk.length >= MAX_SIZE) {
            const increment_val = oversize_count + (segment << 3) + segments;

            this.push(this.frame(increment_val, chunk.subarray(0, MAX_SIZE)));
            chunk = chunk.subarray(MAX_SIZE);
            segment = Math.min(segment + 1, 7);
        }

        this.oversize = (this.oversize + 1) % OVERSIZE_MAX;
    }

    _transform(chunk, _, next) {
        chunk = this.escape(chunk);

        if (chunk.length > MAX_SIZE) {
            this.push_multi(chunk);
        } else {
            this.push(this.frame(0, chunk));
        }

        next();
    }
}

module.exports = ArbosKISSEncoder;
