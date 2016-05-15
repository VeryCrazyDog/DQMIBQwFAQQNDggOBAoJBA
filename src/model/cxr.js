'use strict';

// Include node.js offical modules
const http = require('http');
const https = require('https');

// Include third party modules
const BBPromise = require('bluebird');
const co = require('co');

/** Currency exchange rate model */
class Cxr {
	/**
	 * Currency exchange rate constructor
	 *
	 * @param {string} baseUrl - The base URL for building the data source URL
	 * @constructor
	 */
	constructor(baseUrl) {
		if (baseUrl !== undefined) {
			this.baseUrl = baseUrl;
		} else {
			this.baseUrl = 'http://api.fixer.io/latest';
		}
	}

	/**
	 * Return the data source URL used to get currency exchange rate
	 *
	 * @param {string} from - The currency to exchange from
	 * @param {string} to - The currency to exchange to
	 * @returns {string} - The data source URL
	 */
	getQueryUrl(from, to) {
		return this.baseUrl + '?base=' + from.toUpperCase() + '&symbols=' + to.toUpperCase();
	}

	/**
	 * Currency exchange rate result
	 * @typedef {object} CxrResult
	 *
	 * @param {string} from - The currency to exchange from
	 * @param {string} to - The currency to exchange to
	 * @param {Date} created_at - The number of worker to create. If the value is 0, the number of CPU core will be used.
	 * @param {string} rate - The currency exchange rate in string which has round off to 2 decmicals
	 */
	/**
	 * Get the currency exchange rate from the data source
	 *
	 * @param {string} from - The currency to exchange from
	 * @param {string} to - The currency to exchange to
	 * @returns {Promise} - A promise which resolve to the currency exchange rate result {CxrResult}
	 */
	query(from, to) {
		let self = this;
		return co(function* () {
			from = from.toUpperCase();
			to = to.toUpperCase();
			let url = self.getQueryUrl(from, to);
			let content = yield getContent(url).then(JSON.parse);
			let result = {
				from: from,
				to: to,
				created_at: new Date(),
				rate: undefined
			};
			if (content.base !== from) {
				throw new Error('Invalid response');
			}
			if (typeof content.rates === 'object' && to in content.rates && typeof content.rates[to] === 'number') {
				result.rate = content.rates[to].toFixed(2).toString();
			} else {
				throw new Error('Invalid response');
			}
			return result;
		});
	}
}

// Below are private functions

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

module.exports = Cxr;
