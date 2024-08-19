// index.js is the executable to run the remote system of Arbos
// It instantiates all the singletons we'll need: UDP Adapter, Infrastructure Manager
// File Service, App Scheduler, App Manager, and Bus Interface

// It also will read the config file and determine the location of the radio process, which we will also assume
// is writing to and reading from standard in/out

// const cp = require('child_process');
// const fs = require('fs');
// const os = require('os');
// const path = require('path');

// const UdpAdapter = require('./comm-connection');

// const config_file = fs.readFileSync('./arbos.txt').toString();
// const config = config_file
//     .split('\n')
//     .map(config_line => config_line.split('='))
//     .reduce((accum, curr) => ({ ...accum, [curr[0]]: curr[1] }), {});

// const radio_adapter = cp.exec(config.get('RADIO_ADAPTER_EXEC_PATH'));

// const udp_adapter = new UdpAdapter();

// radio_adapter.stdout.pipe(udp_adapter);
// udp_adapter.pipe(radio_adapter.stdin);

// ########## //

const IMgr = require('./i-mgr');
const conf = require('./arbos.json');
const config = conf; // TODO: Validate this config file on startup

const i = new IMgr(config);

process.stdin.pipe(c);

c.on('data', data => {
    console.log(data);
});