'use strict';

// Include node.js offical modules
const os = require('os');
const cluster = require('cluster');

// Include third party modules
const Promise = require("bluebird");
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

// Define main
const main = function () {
	var i, worker;
	if (cluster.isMaster) {
		console.info('[Master] Master process created');
		for (i = 0; i < cpuCount; i++) {
			cluster.fork();
		}
		cluster.on('exit', function (worker, code, signal) {
			console.info('[Master] Cluster worker ' + worker.process.pid + ' died');
			cluster.fork();
		});
	} else {
		console.info('[Worker.' + cluster.worker.id + '] Cluster worker created');
		worker = new Beanworker({
			id: 'cxr_worker',
			host: config.bs.host,
			port: config.bs.port,
			handlers: {
				cxr: require('./cxrhandler.js')()
			},
		});
		worker.on('started', function () {
			console.info('[Worker.' + cluster.worker.id + '] Beanworker started');
		}).on('stopped', function () {
			console.info('[Worker.' + cluster.worker.id + '] Beanworker stopped');
		}).on('error', function (err) {
			console.error(err);
		}).on('warning', function (err) {
			console.warn('ERROR: ' + err.message);
		}).on('job.reserved', function (id) {
			console.info('Job ' + id + ' reserved');
		}).on('job.handled', function (job) {
			console.info('Job ' + job.id + ' handled');
		}).on('job.deleted', function (id) {
			console.info('Job ' + id + ' deleted');
		}).on('job.buried', function (id) {
			console.info('Job ' + id + ' buried');
		}).start([config.bs.tubeName]);
	}
}

// Call main
main();
