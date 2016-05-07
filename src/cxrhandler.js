'use strict';

var CXRHandler = function () {
	this.type = 'cxr';
}

CXRHandler.prototype.work = function (payload, callback) {
	console.log('work');
	console.log(payload);
	callback('success');
}

module.exports = CXRHandler;
