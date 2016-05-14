'use strict';

// Include node.js offical modules
const http = require('http');
const https = require('https');

// Include third party modules
const Promise = require("bluebird");
const co = require('co');
const fivebeans = require('fivebeans');

// Setup third party classes
const MongoClient = require('mongodb').MongoClient;

// Prototype implementation
const BsWorker = function (id, config) {
	this.id = id;
	this.config = config;
	this.db = null;
	this.bs = null;
};

BsWorker.prototype.start = function () {
	var self = this;
	this.bs = promisifyBs(new fivebeans.client(this.config.bs.host, this.config.bs.port));
	this.bs.on('close', function () {
		console.info('[Worker.%d] Connection to beanstalk has closed', self.id);
	});
	// TODO Better handling process exit condition and connection close
	co(function* () {
		yield [MongoClient.connect(self.config.db.uri).then((db) => {
			self.db = db;
			console.info('[Worker.%d] Connected to mongodb', self.id);
		}), co(function* () {
			var tubelist;
			yield self.bs.connectAsync();
			console.info('[Worker.%d] Connected to beanstalk at %s:%d', self.id, self.config.bs.host, self.config.bs.port);
			yield [
				Promise.all([
					self.bs.watchAsync([self.config.bs.tubeName]),
					self.bs.ignoreAsync(['default'])
				]).then(() => {
					return self.bs.list_tubes_watchedAsync();
				}).then((tubelist) => {
					console.info('[Worker.%d] Watching beanstalk tube for consume job: %s', self.id, tubelist.join(', '));
				}),
				self.bs.useAsync(self.config.bs.tubeName).then((tubeName) => {
					console.info('[Worker.%d] Using beanstalk tube for produce job: %s', self.id, tubeName);
				})
			];
		})];
		return doNextJob.call(self);
	}).catch(function (err) {
		console.error('[Worker.%d] Internal error: %s', self.id, err.stack);
		process.exit(1);
	});
};

const promisifyBs = function (client) {
	Promise.promisifyAll(client, {
		filter: function (name) {
			return name === 'connect';
		},
		promisifier: function (originalFunction, defaultPromisifier) {
			return function promisified() {
				var args = [].slice.call(arguments);
				var self = this;
				return new Promise(function (resolve, reject) {
					self.on('connect', function () {
						resolve();
					}).on('error', function (err) {
						reject(err);
					});
					originalFunction.apply(self, args);
				});
			};
		}
	});
	Promise.promisifyAll(client, {
		filter: function (name) {
			return name === 'reserve';
		},
		multiArgs: true
	});
	Promise.promisifyAll(client);
	return client;
};

const doNextJob = function () {
	var self = this;
	return co(function* () {
		var job, jobId, payload, success, newJobId;
		console.info('[Worker.%d] Waiting for new job to reserve', self.id);
		job = yield self.bs.reserveAsync();
		jobId = job[0];
		console.info('[Worker.%d] Job %s reserved', self.id, jobId);
		payload = parsePayload.call(self, job);
		if (payload !== null) {
			console.info('[Worker.%d] Current payload is: %s', self.id, job[1]);
			success = true;
			try {
				yield processJob.call(self, payload);
			} catch (err) {
				success = false;
				console.info('[Worker.%d] Failed to obtain currency exchange rate: %s', self.id, err);
			}
			if (success) {
				payload.successCount = payload.successCount + 1;
				if (payload.successCount < self.config.jobDoneCount) {
					console.info('[Worker.%d] Job success, putting new job with delay %d seconds', self.id, self.config.successInterval);
					// Make sure the new failed job is put into the queue before destory current job
					newJobId = yield self.bs.putAsync(1000, self.config.successInterval, 60, JSON.stringify(payload));
					console.info('[Worker.%d] New job %s put', self.id, newJobId);
				} else {
					console.info('[Worker.%d] Job done after %d times of success', self.id, payload.successCount);
				}
				console.info('[Worker.%d] Destorying job %s', self.id, jobId);
				yield self.bs.destroyAsync(jobId);
			} else {
				payload.failCount = payload.failCount + 1;
				if (payload.failCount < self.config.jobGaveUpCount) {
					console.warn('[Worker.%d] Job failed, putting new job with delay %d seconds', self.id, self.config.failureInterval);
					// Make sure the new failed job is put into the queue before destory current job
					newJobId = yield self.bs.putAsync(1000, self.config.failureInterval, 60, JSON.stringify(payload));
					console.info('[Worker.%d] New job %s put', self.id, newJobId);
					console.info('[Worker.%d] Destorying job %s', self.id, jobId);
					yield self.bs.destroyAsync(jobId);
				} else {
					console.warn('[Worker.%d] Job gave up after %times of failure, burying job %s', self.id, payload.failCount, jobId);
					buryJob.call(self, jobId);
				}
			}
		} else {
			buryJob.call(self, jobId);
		}
		return doNextJob.call(self);
	});
};

const parsePayload = function (job) {
	var result, type;
	result = null;
	try {
		result = JSON.parse(job[1].toString('ascii'));
		if (typeof result.from == 'string') {
			result.from = result.from.toUpperCase();
		} else {
			throw new Error("Invalid field 'from'");
		}
		if (typeof result.to == 'string') {
			result.to = result.to.toUpperCase();
		} else {
			throw new Error("Invalid field 'to'");
		}
		type = typeof result.successCount;
		if (type == 'undefined') {
			result.successCount = 0;
		} else if (type != 'number') {
			throw new Error("Invalid field 'successCount'");
		}
		type = typeof result.failCount;
		if (type == 'undefined') {
			result.failCount = 0;
		} else if (type != 'number') {
			throw new Error("Invalid field 'failCount'");
		}
	} catch (err) {
		console.warn('[Worker.%d] Invalid payload for job %s: %s', this.id, job[0], err);
	}
	return result;
};

const getContent = function (url) {
	// return new pending promise
	return new Promise((resolve, reject) => {
		// select http or https module, depending on reqested url
		const lib = url.startsWith('https') ? https : http;
		const request = lib.get(url, (response) => {
			// handle http errors
			if (response.statusCode < 200 || response.statusCode > 299) {
				reject(new Error('Failed to load page, status code: ' + response.statusCode));
			}
			// temporary data holder
			const body = [];
			// on every content chunk, push it to the data array
			response.on('data', (chunk) => body.push(chunk));
			// we are done, resolve promise with those joined chunks
			response.on('end', () => resolve(body.join('')));
		});
		// handle connection errors of the request
		request.on('error', (err) => reject(err))
	})
};

const processJob = function (payload) {
	var self = this;
	return co(function* () {
		var url, content, insertResult;
		url = 'http://api.fixer.io/latest?base=' + payload.from + '&symbols=' + payload.to;
		console.info('[Worker.%d] Querying %s', self.id, url);
		content = yield getContent(url).then(JSON.parse);
		// TODO Validate the returned data
		content = {
			from: content.base,
			to: payload.to,
			created_at: new Date(),
			rate: content.rates[payload.to].toFixed(2).toString()
		};
		console.info('[Worker.%d] Inserting data to database', self.id, content);
		yield self.db.collection('xr').insertOne(content);
	});
};

const buryJob = function (jobId) {
	var self = this;
	self.bs.buryAsync(jobId, 1000).then(function () {
		console.info('[Worker.%d] Job %s buried', self.id, jobId);
	}, function (err) {
		console.info('[Worker.%d] Failed to bury job %s: ', self.id, jobId, err);
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