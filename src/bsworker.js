'use strict';

// Include third party modules
const Promise = require("bluebird");
const co = require('co');
const fivebeans = require('fivebeans');

// Setup third party classes
const MongoClient = require('mongodb').MongoClient;
//const Beanworker = require('fivebeans').worker;

// Setup our classes
//const CXRHandler = require('./cxrhandler.js');
const BsClient = require('./bsclient.js');

// Prototype implementation
const BsWorker = function (id, config) {
	this.id = id;
	this.config = config;
	this.db = null;
	this.bs = null;
};

BsWorker.prototype.start = function () {
	this.bs = new BsClient(this.config.bs.host, this.config.bs.port);
	MongoClient.connect(this.config.db.uri).then((db) => {
		console.info('[Worker.%d] Connected to mongodb', this.id);
		this.db = db;
	}).then(() => {
		return this.bs.connect();
	}).then(() => {
		console.info('[Worker.%d] Connected to beanstalk at %s:%d', this.id, this.config.bs.host, this.config.bs.port);
		return Promise.all([this.bs.watch([this.config.bs.tubeName]), this.bs.ignore(['default'])]);
	}).then(() => {
		this.doNext();
	}).catch(function (err) {
		console.error('[Worker.%d] Internal error: %s', this.id, err);
		process.exit(1);
	});

	/*
	
	
	var self = this;
	self.db = yield MongoClient.connect(self.config.db.uri);
	
	
	
	co(function* () {

		self.bs = new BsClient(self.config.bs.host, self.config.bs.port);
		yield self.bs.connect();
		console.info('[Worker.%d] Connected to beanstalk at %s:%d', self.id, self.config.bs.host, self.config.bs.port);
		yield [self.bs.watch([self.config.bs.tubeName]), self.bs.ignore(['default'])];
		self.doNext();
	}).catch(function (err) {
		console.error('[Worker.%d] Internal error: %s', self.id, err);
		process.exit(1);
	});
	*/

	/*
	co(function* () {
		self.db = yield MongoClient.connect(self.config.db.uri);
		console.info('[Worker.%d] Connected to mongodb', self.id);
		self.bs = new fivebeans.client(self.config.bs.host, self.config.bs.port);
		self.bs.on('connect', function () {
			console.info('[Worker.%d] Connected to beanstalk at %s:%d', self.id, self.config.bs.host, self.config.bs.port);
			self.bs.watch([self.config.bs.tubeName], function (err, numWatched) {
				
				
				
				self.bs.ignore(['default'], function () {
					self.bs
					self.doNext();
				});
			});
		}).on('error', function (err) {
			console.error('[Worker.%d] Failed to connect to beanstalk: %s', self.id, err);
			db.close();
			process.exit(1);
		}).on('close', function () {
			db.close();
			process.exit(1);
		}).connect();
	}).catch(function (err) {
		console.error('[Worker.%d] Internal error: %s', self.id, err);
		process.exit(1);
	});
	*/

	/*
			worker = new Beanworker({
				id: 'cxr_worker',
				host: self.config.bs.host,
				port: self.config.bs.port,
				handlers: {
					cxr: new CXRHandler(self.id, self.config, db)
				},
			});
			worker.on('started', function () {
				console.info('[Worker.%d] Beanworker started', self.id);
			}).on('stopped', function () {
				console.info('[Worker.%d] Beanworker stopped', self.id);
			}).on('error', function (err) {
				console.error('[Worker.%d] %s %s', self.id, err.message, err.error);
			}).on('warning', function (err) {
				console.warn('[Worker.%d] %s %s', self.id, err.message, err.error);
			}).on('job.reserved', function (id) {
				console.info('[Worker.%d] Job %s reserved', self.id, id);
			}).on('job.handled', function (job) {
				console.info('[Worker.%d] Job %s handled', self.id, job.id);
			}).on('job.deleted', function (id) {
				console.info('[Worker.%d] Job %s deleted', self.id, id);
			}).on('job.buried', function (id) {
				console.info('[Worker.%d] Job %s buried', self.id, id);
			}).start([self.config.bs.tubeName]);
		}).catch(function (err) {
			console.error('[Worker.%d] %s', self.id, err);
			process.exit(1);
		});
		*/
};


BsWorker.prototype.doNext = function () {
	co(function* () {
		var job;
		job = yield self.reserve();
		console.log(job);
		console.info('[Worker.%d] Job %s reserved', self.id, job.id);

		yield self.destroy(job.id);
	}).catch(function (err) {
		console.error('[Worker.%d] Internal error: %s', self.id, err);
		process.exit(1);
	});
};

BsWorker.prototype.reserve = function () {
	var self = this;
	return new Promise((resolve, reject) => {
		self.bs.reserve(function (err, jobid, payload) {
			if (err) {
				reject(err);
			} else {
				console.info('[Worker.%d] Job %s reserved', self.id, jobid);
				resolve({
					id: jobid,
					payload: payload.toString('ascii')
				});
			}
		});
	});
};



BsWorker.prototype.reserve = function () {
	var self = this;
	return new Promise((resolve, reject) => {
		self.bs.reserve(function (err, jobid, payload) {
			if (err) {
				reject(err);
			} else {
				console.info('[Worker.%d] Job %s reserved', self.id, jobid);
				resolve({
					id: jobid,
					payload: payload.toString('ascii')
				});
			}
		});
	});
};

BsWorker.prototype.destroy = function (jobId) {
	var self = this;
	return new Promise((resolve, reject) => {
		self.bs.destroy(jobid, function (err) {
			if (err) {
				resolve();
			} else {
				reject(err);
			}
		});
	});
};

module.exports = BsWorker;

/*


FiveBeansWorker.prototype.start = function (tubes) {
	var self = this;
	this.stopped = false;

	this.on('next', this.doNext.bind(this));

	function finishedStarting() {
		self.emit('started');
		self.emit('next');
	}

	this.client = new Beanstalk(this.host, this.port);

	this.client.on('connect', function () {
		self.emitInfo('connected to beanstalkd at ' + self.host + ':' + self.port);
		self.watch(tubes, function () {
			if (tubes && tubes.length && self.ignoreDefault) {
				self.ignore(['default'], function () {
					finishedStarting();
				});
			}
			else {
				finishedStarting();
			}
		});
	});

	this.client.on('error', function (err) {
		self.emitWarning({ message: 'beanstalkd connection error', error: err });
		self.emit('error', err);
	});

	this.client.on('close', function () {
		self.emitInfo('beanstalkd connection closed');
		self.emit('close');
	});

	this.client.connect();
};

FiveBeansWorker.prototype.watch = function (tubes, callback) {
	var self = this;
	var tube;
	if (tubes && (tube = tubes[0])) {
		self.emitInfo('watching tube ' + tube);
		self.client.watch(tube, function (err) {
			if (err) self.emitWarning({ message: 'error watching tube', tube: tube, error: err });
			self.watch(tubes.slice(1), callback);
		});
	}
	else
		callback();
};

FiveBeansWorker.prototype.ignore = function (tubes, callback) {
	var self = this;
	var tube;
	if (tubes && (tube = tubes[0])) {
		self.emitInfo('ignoring tube ' + tube);
		self.client.ignore(tube, function (err) {
			if (err) self.emitWarning({ message: 'error ignoring tube', tube: tube, error: err });
			self.ignore(tubes.slice(1), callback);
		});
	}
	else
		callback();
};

FiveBeansWorker.prototype.stop = function () {
	this.emitInfo('stopping...');
	this.stopped = true;
};

FiveBeansWorker.prototype.doNext = function () {
	var self = this;
	if (self.stopped) {
		self.client.end();
		self.emitInfo('stopped');
		self.emit('stopped');
		return;
	}

	self.client.reserve_with_timeout(self.timeout, function (err, jobID, payload) {
		if (err) {
			if ('TIMED_OUT' !== err)
				self.emitWarning({ message: 'error reserving job', error: err });
			self.emit('next');
		}
		else {
			self.emit('job.reserved', jobID);

			var job = null;
			try { job = JSON.parse(payload.toString('ascii')); }
			catch (e) { self.emitWarning({ message: 'parsing job JSON', id: jobID, error: e }); }
			if (!job || !_.isObject(job))
				self.buryAndMoveOn(jobID);
			else if (job instanceof Array)
				self.runJob(jobID, job[1]);
			else
				self.runJob(jobID, job);
		}
	});
};

FiveBeansWorker.prototype.runJob = function (jobID, job) {
	var self = this;
	var handler = this.lookupHandler(job.type);
	if (job.type === undefined) {
		self.emitWarning({ message: 'no job type', id: jobID, job: job });
		self.deleteAndMoveOn(jobID);
	}
	else if (!handler) {
		self.emitWarning({ message: 'no handler found', id: jobID, type: job.type });
		self.buryAndMoveOn(jobID);
	}
	else {
		self.callHandler(handler, jobID, job.payload);
	}
};

FiveBeansWorker.prototype.lookupHandler = function (type) {
	return this.handlers[type];
};

// issue #25
FiveBeansWorker.prototype.callHandler = function callHandler(handler, jobID, jobdata) {
	if (handler.work.length === 3) {
		var patchedHandler = {
			work: function (payload, callback) {
				return handler.work(jobID, payload, callback);
			}
		};
		FiveBeansWorker.prototype.doWork.call(this, patchedHandler, jobID, jobdata);
	}
	else {
		// pass it right on through
		FiveBeansWorker.prototype.doWork.apply(this, arguments);
	}
};

FiveBeansWorker.prototype.doWork = function doWork(handler, jobID, jobdata) {
	var self = this;
	var start = new Date().getTime();
	this.currentJob = jobID;
	this.currentHandler = handler;

	try {
		handler.work(jobdata, function (action, delay) {
			var elapsed = new Date().getTime() - start;

			self.emit('job.handled', { id: jobID, type: handler.type, elapsed: elapsed, action: action });

			switch (action) {
				case 'success':
					self.deleteAndMoveOn(jobID);
					break;

				case 'release':
					self.releaseAndMoveOn(jobID, delay);
					break;

				case 'bury':
					self.buryAndMoveOn(jobID);
					break;

				default:
					self.buryAndMoveOn(jobID);
					break;
			}
		});
	}
	catch (e) {
		self.emitWarning({ message: 'exception in job handler', id: jobID, handler: handler.type, error: e });
		self.buryAndMoveOn(jobID);
	}
};

FiveBeansWorker.prototype.buryAndMoveOn = function (jobID) {
	var self = this;
	self.client.bury(jobID, Beanstalk.LOWEST_PRIORITY, function (err) {
		if (err) self.emitWarning({ message: 'error burying', id: jobID, error: err });
		self.emit('job.buried', jobID);
		self.emit('next');
	});
};

FiveBeansWorker.prototype.releaseAndMoveOn = function (jobID, delay) {
	var self = this;
	if (delay === undefined) delay = 30;

	self.client.release(jobID, Beanstalk.LOWEST_PRIORITY, delay, function (err) {
		if (err) self.emitWarning({ message: 'error releasing', id: jobID, error: err });
		self.emit('job.released', jobID);
		self.emit('next');
	});
};

FiveBeansWorker.prototype.deleteAndMoveOn = function (jobID) {
	var self = this;
	self.client.destroy(jobID, function (err) {
		if (err) self.emitWarning({ message: 'error deleting', id: jobID, error: err });
		self.emit('job.deleted', jobID);
		self.emit('next');
	});
};

FiveBeansWorker.prototype.emitInfo = function (message) {
	this.emit('info', {
		clientid: this.id,
		message: message,
	});
};

FiveBeansWorker.prototype.emitWarning = function (data) {
	data.clientid = this.id;
	this.emit('warning', data);
};

module.exports = FiveBeansWorker;
*/