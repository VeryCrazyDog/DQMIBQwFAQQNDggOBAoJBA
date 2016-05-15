'use strict';

// Include node.js offical modules
const os = require('os');

// Include third party modules
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

// Setup classes for testing
const Cxr = require('../src/model/cxr');
const Job = require('../src/model/job');

// Init
chai.use(chaiAsPromised);
global.should = chai.should();
global.assert = chai.assert;

// Begin test
describe.skip('Cxr', function () {
	describe('#getQueryUrl() with valid input', function () {
		let cxr = new Cxr();
		let from = 'hkd';
		let to = 'USD';
		let result = cxr.getQueryUrl(from, to);
		it('should be a string', function () {
			return chai.expect(result).to.be.a('string');
		});
	});
	describe('#query() with valid input', function () {
		let cxr = new Cxr();
		let from = 'hkd';
		let to = 'USD';
		let result = cxr.query(from, to);
		it('should be a promise', function () {
			return result.should.be.a('promise');
		});
		it('result should be an object', function () {
			return result.should.eventually.be.an('object');
		});
		it('result should have same source currency', function () {
			return result.should.eventually.have.property('from', from.toUpperCase());
		});
		it('result should have same target currency', function () {
			return result.should.eventually.have.property('to', to.toUpperCase());
		});
		it('result created_time should be date', function () {
			return result.should.eventually.have.property('created_at').which.is.instanceof(Date);
		});
		it('result rate should be a string', function () {
			return result.should.eventually.have.property('rate').which.is.a('string');
		});
		it('result rate is a number', function () {
			return result.then(function (payload) {
				return !isNaN(payload.rate);
			}).should.eventually.be.true;
		});
		it('result rate round off to 2 decmicals', function () {
			return result.then(function (payload) {
				let tokens = payload.rate.split('.');
				let decmical;
				switch (tokens.length) {
					case 1:
						decmical = '';
						break;
					case 2:
						decmical = tokens[1];
						break;
					default:
						decmical = 'INVALID NUMBER';
						break;
				}
				return decmical.length;
			}).should.eventually.within(0, 2);
		});
	});
	describe('#query() with invalid input', function () {
		let cxr = new Cxr();
		let from = 'hk';
		let to = 'US';
		let result = cxr.query(from, to);
		it('should be a promise', function () {
			return result.should.be.a('promise');
		});
		it('result should reject with error', function () {
			return result.should.be.rejectedWith(Error);
		});
	});
	describe('#query() with unreachable host', function () {
		let cxr = new Cxr('http://localhost/');
		let from = 'hkd';
		let to = 'USD';
		let result = cxr.query(from, to);
		it('should be a promise', function () {
			return result.should.be.a('promise');
		});
		it('result should reject with error', function () {
			return result.should.be.rejectedWith(Error);
		});
	});
	describe('#query() with invalid response', function () {
		let cxr = new Cxr('https://wtfismyip.com/json');
		let from = 'hkd';
		let to = 'USD';
		let result = cxr.query(from, to);
		it('should be a promise', function () {
			return result.should.be.a('promise');
		});
		it('result should reject with error', function () {
			return result.should.be.rejectedWith(Error);
		});
	});
});

describe('Job', function () {
	let testInitConnection = function (config) {
		let job = new Job(config.worker.bs);
		let result = job.initConnection();
		result.then(() => {
			return job.closeConnection();
		});
		it('should be a promise', function () {
			return result.should.be.a('promise');
		});
		it('result should be an array', function () {
			return result.should.eventually.be.instanceof(Array);
		});
		it('result should have length equal 2', function () {
			return result.should.eventually.have.lengthOf(2);
		});
		it('result watch tube should be an array', function () {
			return result.should.eventually.have.deep.property('[0]').is.instanceof(Array);
		});
		it('result watch tube should have length equal 1', function () {
			return result.should.eventually.have.deep.property('[0]').which.has.lengthOf(1);
		});
		it('result watch tube name should have the specified tube name', function () {
			return result.should.eventually.have.deep.property('[0][0]', config.worker.bs.tubeName);
		});
		it('result use tube name should have the specified tube name', function () {
			return result.should.eventually.have.deep.property('[1]', config.worker.bs.tubeName);
		});
	};
	describe('#initConnection() with valid input', function () {
		// Load configuration
		let config = require('../config/default');
		// Load host-based configuration
		try {
			require('../config/' + os.hostname().toLowerCase())(config);
		} catch (e) {
			// Intended noop to suppress error when no host-based configuration is specified
			Function.prototype;
		}
		// Run test
		testInitConnection(config);
	});
	describe('#initConnection() on default tube name', function () {
		// Load configuration
		let config = require('../config/default');
		// Load host-based configuration
		try {
			require('../config/' + os.hostname().toLowerCase())(config);
		} catch (e) {
			// Intended noop to suppress error when no host-based configuration is specified
			Function.prototype;
		}
		// Run test
		config.worker.bs.tubeName = 'default';
		testInitConnection(config);
	});
	describe('produce and consume', function () {
		// Load configuration
		let config = require('../config/default');
		// Load host-based configuration
		try {
			require('../config/' + os.hostname().toLowerCase())(config);
		} catch (e) {
			// Intended noop to suppress error when no host-based configuration is specified
			Function.prototype;
		}
		// Run test
		let job = new Job(config.worker.bs);
		let payload = { from: 'USD', to: 'HKD' };
		let connectResult = job.initConnection();
		// Put 3 jobs, as beanstalkd sometimes unable to reserve some new put job
		let putResult = connectResult.then(() => {
			return job.put(payload, 60);
		}).then(() => {
			return job.put(payload, 60);
		}).then(() => {
			return job.put(payload, 60);
		});
		let reserveResult = putResult.then((jobId) => {
			return job.reserve();
		});
		let removeResult = reserveResult.then((job) => {
			return job.remove(job.Id);
		});
		it('#put() should be a promise', function () {
			return putResult.should.be.a('promise');
		});
		it('#reserve() should be a promise', function () {
			return reserveResult.should.be.a('promise');
		});
		it('#remove() should be a promise', function () {
			return removeResult.should.be.a('promise');
		});
		it('#put() result should be a string', function () {
			return putResult.should.eventually.be.a('string');
		});
		it('#reserve() result should be an object', function () {
			return reserveResult.should.eventually.be.a('object');
		});
		it('#reserve() result id should be a string', function () {
			return reserveResult.should.eventually.have.property('id').which.is.a('string');
		});
		it('#reserve() result payload should be an object', function () {
			return reserveResult.should.eventually.have.property('payload').which.is.a('object');
		});
		it('#reserve() result payload should has all keys', function () {
			return reserveResult.should.eventually.have.property('payload').have.all.keys('from', 'to', 'successCount', 'failCount');
		});
		it('#remove() result should have no error', function () {
			return removeResult.should.not.be.rejectedWith(Error);
		});
	});
});
