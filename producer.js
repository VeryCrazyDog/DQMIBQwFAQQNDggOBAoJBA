'use strict';

// Include node.js offical modules
const os = require('os');

// Include third party modules
const fivebeans = require('fivebeans');

// Load configuration
let config = require('./config/default.js');
try {
	require('./config/' + os.hostname().toLowerCase() + '.js')(config);
} catch (e) {
	// Intended noop to suppress error when no host-based configuration is specified
	Function.prototype;
}
config.bs.totalCount = 1;

// Main
let client = new fivebeans.client(config.bs.host, config.bs.port);
client.on('connect', function () {
	client.use(config.bs.tubeName, function (err1, tubename) {
		let payload = JSON.stringify({
			'from': 'HKD',
			'to': 'USD'
		});
		for (let i = 0, count = 0; i < config.bs.totalCount; i++) {
			client.put(0, 0, 60, payload, function (err2, jobId) {
				if (err1) {
					console.log(err2);
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
