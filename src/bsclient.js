'use strict';

// Include third party modules
const Promise = require("bluebird");
const co = require('co');
const fivebeans = require('fivebeans');

// Prototype implementation
const BsClient = function (host, port) {
	this.bs = new fivebeans.client(host, port);
};

BsClient.prototype.connect = function () {
	return new Promise((resolve, reject) => {
		this.bs.on('connect', function () {
			resolve();
		}).on('error', function (err) {
			reject(err);
		}).connect();
	});
}

BsClient.prototype.watch = function (tubes) {
	return new Promise((resolve, reject) => {
		this.bs.watch(tubes, (err, numWatched) => {
			if (err) {
				reject(err);
			} else {
				resolve(numWatched);
			}
		});
	});
}

BsClient.prototype.ignore = function (tubes) {
	return new Promise((resolve, reject) => {
		this.bs.ignore(tubes, (err, numWatched) => {
			if (err) {
				reject(err);
			} else {
				resolve(numWatched);
			}
		});
	});
}

BsClient.prototype.list_tubes_watched = function () {
	return new Promise((resolve, reject) => {
		this.bs.list_tubes_watched((err, tubelist) => {
			if (err) {
				reject(err);
			} else {
				resolve(tubelist);
			}
		});
	});
}

BsClient.prototype.reserve = function () {
	return new Promise((resolve, reject) => {
		this.bs.reserve((err, jobId, payload) => {
			if (err) {
				reject(err);
			} else {
				resolve({
					id: jobId,
					payload: payload.toString('ascii')
				});
			}
		});
	});
}

BsClient.prototype.destory = function () {
	return new Promise((resolve, reject) => {
		this.bs.destroy(jobid, (err) => {
			if (err) {
				reject(err);
			} else {
				resolve();
			}
		});
	});
}

module.exports = BsClient;
