const events = require('events');
const fs = require('fs');

const STANDOFF_TIME = 5;

class ApplicationScheduler extends events.EventEmitter {
    static EXECUTE = 'ApplicationScheduler.EXECUTE';

    /**
     * @param {string} schedule_file_path
     */
    constructor(schedule_file_path) {
        super();
        this.file_path = schedule_file_path;
        this.next_execution_commands = null;
    }

    /**
     * @param {Buffer} file_bin
     */
    comprehend_file(file_bin) {
        const file_str = file_bin.toString();
        const now = Date.now();

        try {
            /**
             * @type {{ [startTime: string]: [commandType: string, command: string] }}
             */
            const parsed = JSON.parse(file_str);
            const future_entries = Object.keys(parsed).map(str_e => Number(str_e)).filter(t => t > now);
            const next_entry = Math.min(...future_entries);

            this.next_execution_commands = parsed[next_entry];

            this.wait_until(next_entry - STANDOFF_TIME);
        } catch (err) {
            // Report error to the supervisor
        }
    }

    /**
     * @param {number} timestamp
     */
    wait_until(timestamp) {
        this.standoff_timer = setTimeout(() => {
            clearTimeout(this.standoff_timer);
            this.emit(ApplicationScheduler.EXECUTE, this.next_execution_commands);
            this.read_schedule_contents();
        }, timestamp - Date.now())
    }

    read_schedule_contents() {
        fs.readFile(this.file_path, (err, content) => {
            if (err) {
                // Report error to the supervisor
                return;
            }

            this.comprehend_file(content);
        });
    }

    update() {
        clearTimeout(this.standoff_timer);
        this.read_schedule_contents();
    }
}

module.exports = ApplicationScheduler;
