'use strict';

// Include third party modules
const Promise = require("bluebird");
const co = require('co');

// Setup third party classes
const MongoClient = require('mongodb').MongoClient;
const Beanworker = require('fivebeans').worker;

// Setup our classes
const CXRHandler = require('./cxrhandler.js');

// Prototype implementation
const BsWorker = function (id) {
	this.id = id;
};

BsWorker.prototype.start = function (config) {
	var that = this;
	co(function* () {
		var db, worker;
		db = yield MongoClient.connect(config.db.uri);
		console.info('[Worker.%d] Connected to database', that.id);
		worker = new Beanworker({
			id: 'cxr_worker',
			host: config.bs.host,
			port: config.bs.port,
			handlers: {
				cxr: new CXRHandler()
			},
		});
		worker.on('started', function () {
			console.info('[Worker.%d] Beanworker started', that.id);
		}).on('stopped', function () {
			console.info('[Worker.%d] Beanworker stopped', that.id);
		}).on('error', function (err) {
			console.error('[Worker.%d] %s %s', that.id, err.message, err.error);
		}).on('warning', function (err) {
			console.warn('[Worker.%d] %s %s', that.id, err.message, err.error);
		}).on('job.reserved', function (id) {
			console.info('[Worker.%d] Job %s reserved', that.id, id);
		}).on('job.handled', function (job) {
			console.info('[Worker.%d] Job %s handled', that.id, job.id);
		}).on('job.deleted', function (id) {
			console.info('[Worker.%d] Job %s deleted', that.id, id);
		}).on('job.buried', function (id) {
			console.info('[Worker.%d] Job %s buried', that.id, id);
		}).start([config.bs.tubeName]);
	}).catch(function (err) {
		console.error('[Worker.%d] %s', that.id, err);
		process.exit(1);
	});
}

module.exports = BsWorker;
