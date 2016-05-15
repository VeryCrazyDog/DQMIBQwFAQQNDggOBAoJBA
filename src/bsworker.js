'use strict';

// Include third party modules
const BBPromise = require('bluebird');
const co = require('co');
const fivebeans = require('fivebeans');

// Setup third party classes
const MongoClient = require('mongodb').MongoClient;

// Setup our classes
const Cxr = require('./model/cxr');
const Job = require('./model/job');

/**
 * beanstalk worker constructur
 *
 * @param {number} id - Worker ID
 * @param {WorkerOptions} options - Options parameters
 * @constructor
 */
let BsWorker = function (id, options) {
	this.id = id;
	this.config = options;
	this.db = null;
	this.bs = new Job(this.config.bs);
};

/**
 * Start the worker
 */
BsWorker.prototype.start = function () {
	let self = this;
	// TODO Better handling process exit condition and connection close
	co(function* () {
		yield [MongoClient.connect(self.config.db.uri).then((db) => {
			self.db = db;
			console.info('[Worker.%d] Connected to mongodb', self.id);
		}), co(function* () {
			let connResult = yield self.bs.initConnection();
			console.info('[Worker.%d] Connected to beanstalk at %s:%d', self.id, self.config.bs.host, self.config.bs.port);
			console.info('[Worker.%d] Watching beanstalk tube for consume job: %s', self.id, connResult[0].join(', '));
			console.info('[Worker.%d] Using beanstalk tube for produce job: %s', self.id, connResult[1]);
		})];
		return doNextJob.call(self);
	}).catch(function (err) {
		console.error('[Worker.%d] Internal error: %s', self.id, err.stack);
		process.exit(1);
	});
};

// Below are private functions

let doNextJob = function () {
	let self = this;
	return co(function* () {
		console.info('[Worker.%d] Waiting for new job to reserve', self.id);
		let job = null;
		try {
			job = yield self.bs.reserve();
			console.info('[Worker.%d] Job %s reserved with payload', self.id, job.id, JSON.stringify(job.payload));
		} catch (e) {
			buryJob.call(self, job.id);
			job = null;
		}
		if (job !== null) {
			let success = true;
			try {
				yield processJob.call(self, job.payload);
			} catch (err) {
				success = false;
				console.info('[Worker.%d] Failed to obtain currency exchange rate: %s', self.id, err);
			}
			if (success) {
				job.payload.successCount = job.payload.successCount + 1;
				if (job.payload.successCount < self.config.jobDoneCount) {
					let newJobId;
					console.info('[Worker.%d] Job success, putting new job with delay %d seconds', self.id, self.config.successInterval);
					// Make sure the new failed job is put into the queue before remove current job
					newJobId = yield self.bs.put(job.payload, self.config.successInterval);
					console.info('[Worker.%d] New job %s put', self.id, newJobId);
				} else {
					console.info('[Worker.%d] Job done after %d times of success', self.id, job.payload.successCount);
				}
				console.info('[Worker.%d] Removeing job %s', self.id, job.id);
				yield self.bs.remove(job.id);
			} else {
				job.payload.failCount = job.payload.failCount + 1;
				if (job.payload.failCount < self.config.jobGaveUpCount) {
					let newJobId;
					console.warn('[Worker.%d] Job failed, putting new job with delay %d seconds', self.id, self.config.failureInterval);
					// Make sure the new failed job is put into the queue before remove current job
					newJobId = yield self.bs.put(job.payload, self.config.failureInterval);
					console.info('[Worker.%d] New job %s put', self.id, newJobId);
					console.info('[Worker.%d] Removeing job %s', self.id, job.id);
					yield self.bs.remove(job.id);
				} else {
					console.warn('[Worker.%d] Job gave up after %times of failure, burying job %s', self.id, job.payload.failCount, job.id);
					buryJob.call(self, job.id);
				}
			}
		} else {
			buryJob.call(self, job.id);
		}
		return doNextJob.call(self);
	});
};

let processJob = function (payload) {
	let self = this;
	return co(function* () {
		let cxr = new Cxr();
		console.info('[Worker.%d] Querying %s', self.id, cxr.getQueryUrl(payload.from, payload.to));
		let content = yield cxr.query(payload.from, payload.to);
		console.info('[Worker.%d] Inserting data to database', self.id, content);
		yield self.db.collection('xr').insertOne(content);
	});
};

let buryJob = function (jobId) {
	let self = this;
	self.bs.bury(jobId).then(function () {
		console.info('[Worker.%d] Job %s buried', self.id, jobId);
	}, function (err) {
		console.info('[Worker.%d] Failed to bury job %s: ', self.id, jobId, err);
	});
};

module.exports = BsWorker;
