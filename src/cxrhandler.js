'use strict';

// Include node.js offical modules
const http = require('http');
const https = require('https');

// Include third party modules
const Promise = require("bluebird");
const co = require('co');

// Helper functions
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

// Prototype implementation
const CXRHandler = function (workerId, config, db) {
	this.type = 'cxr';
	this.id = workerId;
	this.config = config;
	this.db = db;
};

CXRHandler.prototype.work = function (payload, callback) {
	const that = this;
	if (this.checkPayload(payload)) {
		co(function* () {
			var url, content, insertResult;
			url = 'http://api.fixer.io/latest?base=' + payload.from + '&symbols=' + payload.to;
			console.info('[Worker.%d] Querying %s', that.id, url);
			content = yield getContent(url).then(JSON.parse);
			// TODO Validation on the returned data
			content = {
				from: content.base,
				to: payload.to,
				created_at: new Date(),
				rate: content.rates[payload.to].toFixed(2).toString()
			};
			console.info('[Worker.%d] Inserting data', that.id, content);
			insertResult = yield that.db.collection('xr').insertOne(content);
			if (insertResult.result.ok) {
				callback('success');
			} else {
				callback('bury');
			}
		}).catch(function (err) {
			console.error('[Worker.%d] %s', that.id, err);
			callback('bury');
		});
	} else {
		// Invalid payload, bury the job
		callback('bury');
	}
};

CXRHandler.prototype.checkPayload = function (payload) {
	var result, type;
	result = (typeof payload.from == 'string' && typeof payload.to == 'string');
	if (result) {
		payload.from = payload.from.toUpperCase();
		payload.to = payload.to.toUpperCase();
		type = typeof payload.successCount;
		result = (result && (type == 'number' || type == 'undefined'));
		type = typeof payload.failCount;
		result = (result && (type == 'number' || type == 'undefined'));
	}
	return result;
}

module.exports = CXRHandler;
