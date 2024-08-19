const child_process = require('child_process');
const stream = require('stream');
const FileService = require('../file-service/service');
const CommConnection = require('./comm-connection');

/**
 * @param {string[]} radio_proc
 * @returns {[command: string, args: string[]]}
 */
const parse_radio_args = (radio_proc) => {
    const [cmd, ...rest] = radio_proc;

    return [cmd, rest];
}

class InfrastructureManager {
    constructor({ radio_proc, radio_proc_wd, schedule_file_path }) {
        // Create the file service duplexer that will talk directly to the communication connection
        const file_service = new FileService();
        // Create streams for non-file messages
        const received = new stream.PassThrough();
        const downlink = new stream.PassThrough();
        // Connect the comm connection
        const comm_connection = new CommConnection({ file_service, received, downlink });

        // Instantiate the radio stream from the config arg
        const radio_stream = child_process.spawn(...parse_radio_args(radio_proc), { cwd: radio_proc_wd });

        // Connect the radio stream to our communications connection.
        radio_stream.stdout.pipe(comm_connection);
        comm_connection.pipe(radio_stream.stdin);

        // Listen for messages received
        received.on('data', telecommand => {
            this.handler.write(telecommand);
        });
    }
}

module.exports = InfrastructureManager;
