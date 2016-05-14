'use strict';

// Include node.js offical modules
const os = require('os');
const cluster = require('cluster');

// Setup our classes
const BsWorker = require('./src/bsworker.js');

// Setup constants
const cpuCount = os.cpus().length;

// Load configuration
const config = require('./config/default.js');
try {
    require('./config/' + os.hostname().toLowerCase() + '.js')(config);
} catch (e) {
}

// Define main
const main = function () {
	var i, workerCount, worker;
	if (cluster.isMaster) {
		console.info('[Master] Master process created');
		if (config.workerCount > 0) {
			workerCount = config.workerCount;
		} else {
			workerCount = cpuCount;
		}
		for (i = 0; i < workerCount; i++) {
			cluster.fork();
		}
		cluster.on('exit', function (worker, code, signal) {
			console.info('[Master] Cluster worker %d died', worker.process.pid);
			// Sleep for 1 second to prevent looping
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
