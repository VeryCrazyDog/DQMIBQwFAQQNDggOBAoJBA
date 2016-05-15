'use strict';

/**
 * Master Process Options
 * @typedef {object} MasterOptions
 *
 * @param {number} workerCount - The number of worker to create. If the value is 0, the number of CPU core will be used.
 */

/**
 * Options for beanstalkd server
 * @typedef {object} BsOptions
 *
 * @param {string} host - The address of the beanstalkd server
 * @param {number} port - The port of the beanstalkd server to connect to
 * @param {string} tubeName - The tube name to use
 */

/**
 * Worker Process Options
 * @typedef {object} WorkerOptions
 *
 * @param {number} jobDoneCount - The total number of successful request count until the job is marked as done
 * @param {number} jobGaveUpCount - The total number of fail request count until gave up the job
 * @param {number} successInterval - The number of seconds to delay for the next request if the current request success
 * @param {number} failureInterval - The number of seconds to delay for the next request if the current request failed
 * @param {BsOptions} bs - Options parameters for beanstalk
 * @param {object} db - Options parameters for MongoDB
 * @param {string} db.uri - The URI of the MongoDB server, reference: https://docs.mongodb.com/v3.0/reference/connection-string/
 */

/**
 * Script Configuration
 *
 * @param {object} config - Script configuration
 * @param {MasterOptions} config.master - Master process options
 * @param {WorkerOptions} config.worker - Worker process options
 */
let config = {
	master: {
		workerCount: 0
	},
	worker: {
		jobDoneCount: 10,
		jobGaveUpCount: 3,
		successInterval: 60,
		failureInterval: 3,
		bs: {
			host: 'localhost',
			port: 11300,
			tubeName: 'bs'
		},
		db: {
			uri: 'mongodb://<dbuser>:<dbpassword>@<host>:<port>/<dbname>'
		}
	}
};

module.exports = config;
