'use strict';

// Include node.js offical modules
const os = require('os');
const cluster = require('cluster');

// Setup our classes
const BsWorker = require('./src/bsworker.js');

// Setup constants
const CPU_COUNT = os.cpus().length;

/**
 * Main function
 */
var main = function () {
	var config, i, workerCount, worker;
	// Load configuration
	config = require('./config/default.js');
	// Load host-based configuration
	try {
		require('./config/' + os.hostname().toLowerCase() + '.js')(config);
	} catch (e) {
	}
	if (cluster.isMaster) {
		console.info('[Master] Master process created');
		if (config.workerCount > 0) {
			workerCount = config.workerCount;
		} else {
			workerCount = CPU_COUNT;
		}
		for (i = 0; i < workerCount; i++) {
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
		worker = new BsWorker(cluster.worker.id, config);
		worker.start();
	}
}

// Call main
main();
