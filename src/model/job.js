'use strict';

// Include third party modules
const BBPromise = require('bluebird');
const co = require('co');
const fivebeans = require('fivebeans');

/** Currency exchange job model */
class Job {
	/**
	 * Currency exchange job constructor
	 *
	 * @param {BsOptions} options - Options for beanstalkd server
	 * @constructor
	 */
	constructor(options) {
		this.options = options;
		this.bs = promisifyBs(new fivebeans.client(this.options.host, this.options.port));
	}

	/**
	 * Connection result to beanstalkd server
	 * @typedef {Array} BsConnResult
	 *
	 * @param {string[]} BsConnResult[0] - A string array which contains the list of tube which are watching 
	 * @param {string} BsConnResult[1] - The tube name which produced job goes to
	 */
	/**
	 * Initialize the connection to beanstalkd server
	 *
	 * @returns {Promise} - A promise which resolve to beanstalkd connection result {BsConnResult}
	 */
	initConnection() {
		let self = this;
		return co(function* () {
			yield self.bs.connectAsync();
			let initConsumer = self.bs.watchAsync([self.options.tubeName]);
			if (self.options.tubeName !== 'default') {
				initConsumer = initConsumer.then(() => {
					return self.bs.ignoreAsync(['default']);
				});
			}
			initConsumer = initConsumer.then(() => {
				return self.bs.list_tubes_watchedAsync();
			});
			return BBPromise.all([
				initConsumer,
				self.bs.useAsync(self.options.tubeName)
			]);
		});
	}

	/**
	 * Job Details
	 * @typedef {object} JobDetails
	 * 
	 * @returns {string} id - The ID of the job
	 * @returns {object} payload - The payload of the job
	 * @returns {string} payload.from - The currency to exchange from
	 * @returns {string} payload.to - The currency to exchange to
	 * @returns {string} payload.successCount - The total number of success in processing the job
	 * @returns {string} payload.failCount - The total number of failure in processing the job
	 */
	/**
	 * Reserve a job from the underlying beanstalkd server
	 *
	 * @returns {Promise} - A promise which resolve to the job details {JobDetails}
	 */
	reserve() {
		let self = this;
		return co(function* () {
			let job = yield self.bs.reserveAsync();
			return {
				id: job[0],
				payload: parsePayload(job[1])
			};
		});
	}

	/**
	 * Remove/destroy a job from the underlying beanstalkd server
	 *
	 * @param {string} jobId - The job ID of the job to be removed 
	 * @returns {Promise} - A promise
	 */
	remove(jobId) {
		return this.bs.destroyAsync(jobId);
	}

	/**
	 * Bury a job from the underlying beanstalkd server
	 *
	 * @param {string} jobId - The job ID of the job to be buried
	 * @returns {Promise} - A promise
	 */
	bury(jobId) {
		return this.bs.buryAsync(jobId, 1000);
	}

	/**
	 * Put a job to the underlying beanstalkd server
	 *
	 * @param {object} data - The data to put
	 * @param {number} delay - The number of second to delay until the job can be reserved
	 * @returns {Promise} - A promise which resolve to the job ID {string}
	 */
	put(data, delay) {
		return this.bs.putAsync(1000, delay, 60, JSON.stringify(data));
	}

	/**
	 * Close the connection to the underlying beanstalkd server
	 *
	 * @returns {Promise} - A promise
	 */
	closeConnection() {
		return this.bs.quitAsync();
	}
}

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
			return (name === 'reserve' || name === 'reserve_with_timeout');
		},
		multiArgs: true
	});
	BBPromise.promisifyAll(client);
	return client;
};

let parsePayload = function (payload) {
	let result = null;
	result = JSON.parse(payload.toString('ascii'));
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
	return result;
};

module.exports = Job;
