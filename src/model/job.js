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
	 * @constructor
	 */
	constructor(options) {
		this.options = options;
		this.bs = promisifyBs(new fivebeans.client(this.options.host, this.options.port));
	}

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

	ack(jobId) {
		return this.bs.destroyAsync(jobId);
	}

	bury(jobId) {
		return this.bs.buryAsync(jobId, 1000);
	}

	put(data, delay) {
		return this.bs.putAsync(1000, delay, 60, JSON.stringify(data));
	}

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
