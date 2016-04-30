'use strict';

// Include modules
var fivebeans = require('fivebeans');

// Include config
var config = {
    host: 'localhost',
    port: 11300,
    tubeName: 'test'
};

// Main
var client = new fivebeans.client(config.host, config.port);
client.on('connect', function () {
    client.use(config.tubeName, function (err, tubename) {
        var payload, i;
        payload = JSON.stringify({
            type: 'cxr',
            payload: 'testing123'
        });
        for (i = 0; i < 5; i++) {
            client.put(0, 0, 1000, payload, function (err, jobid) {
                if (err) {
                    console.log(err);
                } else {
                    console.log('success, job ID: ' + jobid);
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
