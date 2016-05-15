'use strict';

// Include node.js offical modules
const os = require('os');
const cluster = require('cluster');

// Setup our classes
const BsWorker = require('./src/bsworker.js');

/**
 * Main function
 */
let main = function () {
	let config;
	// Load configuration
	config = require('./config/default.js');
	// Load host-based configuration
	try {
		require('./config/' + os.hostname().toLowerCase() + '.js')(config);
	} catch (e) {
		// Intended noop to suppress error when no host-based configuration is specified
		Function.prototype;
	}
	if (cluster.isMaster) {
		console.info('[Master] Master process created');
		config = config.master;
		let workerCount;
		if (config.workerCount > 0) {
			workerCount = config.workerCount;
		} else {
			workerCount = os.cpus().length;
		}
		for (let i = 0; i < workerCount; i++) {
			cluster.fork();
		}
		cluster.on('exit', function (worker, code, signal) {
			console.info('[Master] Cluster worker %d died', worker.process.pid);
			// Sleep for a while to prevent high loading if looping occur
			setTimeout(function () {
				cluster.fork();
			}, 5000);
		});
	} else {
		console.info('[Worker.%d] Cluster worker created', cluster.worker.id);
		config = config.worker;
		let worker;
		worker = new BsWorker(cluster.worker.id, config);
		worker.start();
	}
};

// Call main
main();
