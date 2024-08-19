const stream = require('stream');
const SendChannel = require('./send-channel');
const ReceiveChannel = require('./receive-channel');
const { IMPORT, EXPORT } = require('./message-types');

class FileService extends stream.Duplex {
    constructor() {
        super({ writableObjectMode: true, readableObjectMode: true });

        this.channels = new Map();
    }

    create_send_channel(channel_id, local_path) {
        const new_send_channel = new SendChannel(channel_id, local_path);

        new_send_channel.on('data', msg => {
            this.push(msg);
        });

        new_send_channel.on(SendChannel.TASK_COMPLETE, () => {
            this.remove_channel(channel_id);
        });

        this.channels.set(channel_id, new_send_channel);
    }

    /**
     * @param {number} channel_id
     * @param {string} hash
     * @param {number} num_chunks
     * @param {string} file_destination
     */
    create_receive_channel(channel_id, hash, num_chunks) {
        const new_rec_channel = new ReceiveChannel(channel_id, hash, num_chunks, file_destination);

        new_rec_channel.on('data', msg => {
            this.push(msg);
        });

        new_rec_channel.on(ReceiveChannel.TASK_COMPLETE, () => {
            this.remove_channel(channel_id);
        });

        this.channels.set(channel_id, new_rec_channel);
    }

    remove_channel(channel_id) {
        const to_remove = this.channels.get(channel_id);

        if (to_remove) {
            to_remove.removeAllListeners();

            this.channels.delete(channel_id);
        }
    }

    get_channel_manager(message) {
        const [channel_id, type, request_path, num_chunks, file_destination] = message;

        if (type === IMPORT) {
            return this.create_send_channel(channel_id, request_path);
        }

        if (type === EXPORT) {
            return this.create_receive_channel(channel_id, request_path, num_chunks, file_destination);
        }
    }

    _write(chunk, _, next) {
        const [channel_id, command] = chunk;
        const channel = this.channels.get(channel_id);

        if (channel) {
            channel.write(chunk);

            return next();
        }

        if ([IMPORT, EXPORT].includes(command)) {
            this.get_channel_manager(chunk);
        } else {
            this.push([channel_id, 6, `No existing channel, cannot execute ${command}`]);
        }

        next();
    }

    _read() { /* Empty */ }
}

module.exports = FileService;
