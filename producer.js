'use strict';

// Include node.js offical modules
const os = require('os');

// Include third party modules
const fivebeans = require('fivebeans');

// Setup classes
const Beanworker = fivebeans.worker;

// Setup constants
const cpuCount = os.cpus().length;

// Load configuration
const config = require('./config/default.js');
try {
    require('./config/' + os.hostname().toLowerCase() + '.js')(config);
} catch (e) {
}
config.bs.totalCount = 1;

// Main
var client = new fivebeans.client(config.bs.host, config.bs.port);
client.on('connect', function () {
    client.use(config.bs.tubeName, function (err, tubename) {
        var payload, i, count;
        payload = JSON.stringify({
            "from": "HKD",
            "to": "USD"
        });
        for (i = 0, count = 0; i < config.bs.totalCount; i++) {
            client.put(0, 0, 60, payload, function (err, jobId) {
                if (err) {
                    console.log(err);
                } else {
                    console.log('success, job ID: ' + jobId);
                }
                count++;
                if (count >= config.bs.totalCount) {
                    process.exit();
                }
            });
        }
    });
}).on('error', function (err) {
    console.log('error');
    process.exit();
}).on('close', function () {
    console.log('close');
    process.exit();
}).connect();
