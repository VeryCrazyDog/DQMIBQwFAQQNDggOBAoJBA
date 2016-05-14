'use strict';

module.exports = {
	workerCount: 0,
	bs: {
		host: 'localhost',
		port: 11300,
		tubeName: 'bs'
	},
	db: {
		uri: 'mongodb://<dbuser>:<dbpassword>@<host>:<port>/<dbname>'
	}
};
