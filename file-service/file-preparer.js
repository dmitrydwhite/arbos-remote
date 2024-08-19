const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const stream = require('stream');

const CHUNK_SIZE = 16000;

class FilePreparer extends stream.Writable {
    static STORAGE_FINISHED = 'FilePreparer.STORAGE_FINISHED';

    constructor() {
        super();

        this.working_data = Buffer.alloc(0);
        this.hash = crypto.createHash('MD5');
        this.temp_path = path.join(os.tmpdir(), crypto.randomUUID());
        this.file_index = 0;
        this.write_count = 0;

        fs.mkdirSync(this.temp_path);
    }

    _write(chunk, _, next) {
        this.hash.update(chunk);

        let all_recd = Buffer.concat([this.working_data, chunk]);

        while (all_recd.length >= CHUNK_SIZE) {
            fs.writeFileSync(path.join(this.temp_path, `${this.file_index}`), all_recd.subarray(0, CHUNK_SIZE));
            this.file_index += 1;
            all_recd = all_recd.subarray(CHUNK_SIZE)
        }

        this.working_data = all_recd;
        next();
    }

    _final(done) {
        if (this.working_data.length) {
            fs.writeFileSync(path.join(this.temp_path, `${this.file_index}`), this.working_data);
            this.file_index += 1;
        }

        const hash_value = this.hash.digest('hex');
        const storage_path = path.join(os.tmpdir(), hash_value);
        const prep_call = fs.existsSync(storage_path)
            ? Promise.all(fs.readdirSync(storage_path).map(old => fsp.rm(path.join(storage_path, old)))).then(() => fsp.rmdir(storage_path))
            : Promise.resolve();

        prep_call
            .then(() => {
                fs.mkdirSync(storage_path);

                return Promise
                    .all(fs.readdirSync(this.temp_path).map(fileName =>
                        fsp.copyFile(path.join(this.temp_path, fileName), path.join(storage_path, `${fileName}`))
                    ))
            }).then(() => {
                this.emit(
                    FilePreparer.STORAGE_FINISHED,
                    {
                        num_chunks: this.file_index,
                        storage_path,
                    }
                );

                done();
            });
    }
}

module.exports = FilePreparer;
