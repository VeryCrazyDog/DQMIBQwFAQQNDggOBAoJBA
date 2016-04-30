'use strict';

module.exports = function() {
	function CXRHandler() {
		this.type = 'cxr';
	}

	CXRHandler.prototype.work = function(payload, callback) {
		console.log('work');
		console.log(payload);
		callback('success');
	}

	var handler = new CXRHandler();
	return handler;
};
