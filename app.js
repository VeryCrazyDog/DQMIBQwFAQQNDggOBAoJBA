'use strict';

// Include modules
var fivebeans = require('fivebeans');
var Promise = require("bluebird");


// Include config
var config = {
	tubeName: 'test'
};

var Beanworker = fivebeans.worker;
var worker = new Beanworker({
	id: 'cxr_worker',
	host: 'localhost',
	port: 11300,
	handlers: {
		cxr: require('./cxrhandler.js')()
	},
});
worker.on('started', function () {
	console.log('Worker started');
}).on('stopped', function () {
	console.log('Worker stopped');
}).on('error', function (err) {
	console.log(err);
}).on('warning', function (err) {
	console.log('ERROR: ' + err.message);
}).on('job.reserved', function (id) {
	console.log('Job ' + id + ' reserved');
}).on('job.handled', function (job) {
	console.log('Job ' + job.id + ' handled');
}).on('job.deleted', function (id) {
	console.log('Job ' + id + ' deleted');
}).on('job.buried', function (id) {
	console.log('Job ' + id + ' buried');
}).start([config.tubeName]);
