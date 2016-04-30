'use strict';

// Include modules
var Promise = require("bluebird");
var co = require('co');
var fivebeans = require('fivebeans');

// Include config
var config = {
    host: 'localhost',
    port: 11300,
    tubeName: 'test',
    totalCount: 5
};

// Main
var client = new fivebeans.client(config.host, config.port);
client.on('connect', function () {
    client.use(config.tubeName, function (err, tubename) {
        var payload, i, count;
        payload = JSON.stringify({
            type: 'cxr',
            payload: {
                "from": "HKD",
                "to": "USD"
            }
        });
        for (i = 0, count = 0; i < config.totalCount; i++) {
            client.put(0, 0, 1000, payload, function (err, jobId) {
                if (err) {
                    console.log(err);
                } else {
                    console.log('success, job ID: ' + jobId);
                }
                count++;
                if (count >= config.totalCount) {
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
