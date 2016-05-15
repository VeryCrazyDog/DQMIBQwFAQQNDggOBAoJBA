'use strict';

// Include third party modules
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

// Setup classes for testing
const Cxr = require('../src/model/cxr.js');

// Init
chai.use(chaiAsPromised);
global.should = chai.should();
global.assert = chai.assert;

// Begin test
describe('Cxr', function () {
	describe('#getQueryUrl() with valid input', function () {
		let cxr = new Cxr();
		let from = 'hkd';
		let to = 'USD';
		let result = cxr.getQueryUrl(from, to);
		it('Should be a promise', function () {
			return chai.expect(result).to.be.a('string');
		});
	});
	describe('#query() with valid input', function () {
		let cxr = new Cxr();
		let from = 'hkd';
		let to = 'USD';
		let queryResult = cxr.query(from, to);
		it('Should be a promise', function () {
			return queryResult.should.be.a('promise');
		});
		it('Result should be an object', function () {
			return queryResult.should.eventually.be.an('object');
		});
		it('Result should have same source currency', function () {
			return queryResult.should.eventually.have.property('from', from.toUpperCase());
		});
		it('Result should have same target currency', function () {
			return queryResult.should.eventually.have.property('to', to.toUpperCase());
		});
		it('Result created_time should be date', function () {
			return queryResult.should.eventually.have.property('created_at').which.is.instanceof(Date);
		});
		it('Result rate should be a string', function () {
			return queryResult.should.eventually.have.property('rate').which.is.a('string');
		});
		it('Result rate is a number', function () {
			return queryResult.then(function (payload) {
				return !isNaN(payload.rate);
			}).should.eventually.be.true;
		});
		it('Result rate round off to 2 decmicals', function () {
			return queryResult.then(function (payload) {
				let tokens = payload.rate.split('.');
				let result;
				switch (tokens.length) {
					case 1:
						result = '';
						break;
					case 2:
						result = tokens[1];
						break;
					default:
						result = 'INVALID NUMBER';
						break;
				}
				return result;
			}).should.eventually.have.length.within(0, 2);
		});
	});
	describe('#query() with invalid input', function () {
		let cxr = new Cxr();
		let from = 'hk';
		let to = 'US';
		let result = cxr.query(from, to);
		it('Should be a promise', function () {
			return result.should.be.a('promise');
		});
		it('Result should reject with error', function () {
			return result.should.be.rejectedWith(Error);
		});
	});
	describe('#query() with unreachable host', function () {
		let cxr = new Cxr('http://localhost/');
		let from = 'hkd';
		let to = 'USD';
		let result = cxr.query(from, to);
		it('Should be a promise', function () {
			return result.should.be.a('promise');
		});
		it('Result should reject with error', function () {
			return result.should.be.rejectedWith(Error);
		});
	});
	describe('#query() with invalid response', function () {
		let cxr = new Cxr('https://wtfismyip.com/json');
		let from = 'hkd';
		let to = 'USD';
		let result = cxr.query(from, to);
		it('Should be a promise', function () {
			return result.should.be.a('promise');
		});
		it('Result should reject with error', function () {
			return result.should.be.rejectedWith(Error);
		});
	});
});
