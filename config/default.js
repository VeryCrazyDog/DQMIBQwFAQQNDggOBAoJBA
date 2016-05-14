'use strict';

module.exports = {
	workerCount: 0,
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
};
