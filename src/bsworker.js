'use strict';

// Include node.js offical modules
const http = require('http');
const https = require('https');

// Include third party modules
const BBPromise = require('bluebird');
const co = require('co');
const fivebeans = require('fivebeans');

// Setup third party classes
const MongoClient = require('mongodb').MongoClient;

/**
 * beanstalk worker constructur
 *
 * @param {number} id - Worker ID
 * @param {object} options - Options parameters
 * @param {number} options.jobDoneCount - The total number of successful request count until the job is marked as done
 * @param {number} options.jobGaveUpCount - The total number of fail request count until gave up the job
 * @param {number} options.successInterval - The number of seconds to delay for the next request if the current request success
 * @param {number} options.failureInterval - The number of seconds to delay for the next request if the current request failed
 * @param {object} options.bs - Options parameters for beanstalk
 * @param {string} options.bs.host - The address of the beanstalkd server
 * @param {number} options.bs.port - The port of the beanstalkd server to connect to
 * @param {string} options.bs.tubeName - The tube name to use
 * @param {object} options.db - Options parameters for MongoDB
 * @param {string} options.db.uri - The URI of the MongoDB server
 * @constructor
 */
let BsWorker = function (id, options) {
	this.id = id;
	this.config = options;
	this.db = null;
	this.bs = null;
};

/**
 * Start the worker
 */
BsWorker.prototype.start = function () {
	let self = this;
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
			yield self.bs.connectAsync();
			console.info('[Worker.%d] Connected to beanstalk at %s:%d', self.id, self.config.bs.host, self.config.bs.port);
			yield [
				BBPromise.all([
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

// Below are private functions

let promisifyBs = function (client) {
	BBPromise.promisifyAll(client, {
		filter: function (name) {
			return name === 'connect';
		},
		promisifier: function (originalFunction, defaultPromisifier) {
			return function promisified() {
				let args = [].slice.call(arguments);
				let self = this;
				return new BBPromise(function (resolve, reject) {
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
	BBPromise.promisifyAll(client, {
		filter: function (name) {
			return name === 'reserve';
		},
		multiArgs: true
	});
	BBPromise.promisifyAll(client);
	return client;
};

let doNextJob = function () {
	let self = this;
	return co(function* () {
		console.info('[Worker.%d] Waiting for new job to reserve', self.id);
		let job = yield self.bs.reserveAsync();
		let jobId = job[0];
		console.info('[Worker.%d] Job %s reserved', self.id, jobId);
		let payload = parsePayload.call(self, job);
		if (payload !== null) {
			let success;
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
					let newJobId;
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
					let newJobId;
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

let parsePayload = function (job) {
	let result = null;
	try {
		result = JSON.parse(job[1].toString('ascii'));
		if (typeof result.from === 'string') {
			result.from = result.from.toUpperCase();
		} else {
			throw new Error("Invalid field 'from'");
		}
		if (typeof result.to === 'string') {
			result.to = result.to.toUpperCase();
		} else {
			throw new Error("Invalid field 'to'");
		}
		let type = typeof result.successCount;
		if (type === 'undefined') {
			result.successCount = 0;
		} else if (type !== 'number') {
			throw new Error("Invalid field 'successCount'");
		}
		type = typeof result.failCount;
		if (type === 'undefined') {
			result.failCount = 0;
		} else if (type !== 'number') {
			throw new Error("Invalid field 'failCount'");
		}
	} catch (err) {
		console.warn('[Worker.%d] Invalid payload for job %s: %s', this.id, job[0], err);
	}
	return result;
};

let getContent = function (url) {
	// return new pending promise
	return new BBPromise((resolve, reject) => {
		// select http or https module, depending on reqested url
		let lib = url.startsWith('https') ? https : http;
		let request = lib.get(url, (response) => {
			// handle http errors
			if (response.statusCode < 200 || response.statusCode > 299) {
				reject(new Error('Failed to load page, status code: ' + response.statusCode));
			}
			// temporary data holder
			let body = [];
			// on every content chunk, push it to the data array
			response.on('data', (chunk) => body.push(chunk));
			// we are done, resolve promise with those joined chunks
			response.on('end', () => resolve(body.join('')));
		});
		// handle connection errors of the request
		request.on('error', (err) => reject(err));
	});
};

let processJob = function (payload) {
	let self = this;
	return co(function* () {
		let url = 'http://api.fixer.io/latest?base=' + payload.from + '&symbols=' + payload.to;
		console.info('[Worker.%d] Querying %s', self.id, url);
		let content = yield getContent(url).then(JSON.parse);
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

let buryJob = function (jobId) {
	let self = this;
	self.bs.buryAsync(jobId, 1000).then(function () {
		console.info('[Worker.%d] Job %s buried', self.id, jobId);
	}, function (err) {
		console.info('[Worker.%d] Failed to bury job %s: ', self.id, jobId, err);
	});
};

module.exports = BsWorker;
