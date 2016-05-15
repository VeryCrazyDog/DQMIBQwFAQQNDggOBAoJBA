'use strict';

module.exports = function (config) {
	config.worker.bs.host = 'localhost';
	config.worker.bs.tubeName = 'default';
	config.worker.db.uri = 'mongodb://user:password@db1.example.net:2500/db';
};
