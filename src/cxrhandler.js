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
const CXRHandler = function (workerId, config) {
	this.id = workerId;
	this.config = config;
	this.type = 'cxr';
}


CXRHandler.prototype.work = function (payload, callback) {
	const that = this;
	var base, to, url;
	if (typeof payload.from == 'string' && typeof payload.to == 'string') {
		base = payload.from.toUpperCase();
		to = payload.to.toUpperCase();
		url = 'http://api.fixer.io/latest?base=' + base + '&symbols=' + to;
		console.info('[Worker.%d] Querying %s', this.id, url);
		co(function* () {
			var content;
			content = yield getContent(url).then(JSON.parse);
			// TODO Validation on the returned data
			content = {
				from: base,
				to: to,
				created_at: new Date(),
				rate: content.rates[to].toFixed(2).toString()
			};
			console.log(content);
			callback('success');
		}).catch(function (err) {
			console.error('[Worker.%d] %s', that.id, err);
		});
	} else {
		callback('bury');
	}
}

module.exports = CXRHandler;
