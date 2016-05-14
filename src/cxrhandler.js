'use strict';

// Include node.js offical modules
const http = require('http');
const https = require('https');

// Include third party modules
const Promise = require("bluebird");
const co = require('co');

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

module.exports = CXRHandler;
