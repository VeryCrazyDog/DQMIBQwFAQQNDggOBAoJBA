'use strict';

// Include third party modules
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

// Setup classes for testing
const CXR = require('../src/model/cxr.js');

// Init
chai.use(chaiAsPromised);
global.expect = chai.expect;
global.should = chai.should();
global.assert = chai.assert;

// Begin test
describe('CXR', function () {
	describe('#getQueryUrl() with invalid input', function () {
		let cxr = new CXR();
		let from = 'hkd';
		let to = 'USD';
		let result = cxr.getQueryUrl(from, to);
		it('Should be a promise', function () {
			return expect(result).to.be.a('string');
		});
	});
	describe('#query() with valid input', function () {
		let cxr = new CXR();
		let from = 'hkd';
		let to = 'USD';
		let result = cxr.query(from, to);
		it('Should be a promise', function () {
			return result.should.be.a('promise');
		});
		it('Result should be an object', function () {
			return result.should.eventually.be.an('object');
		});
		it('Result should have same source currency', function () {
			return result.should.eventually.have.property('from', from.toUpperCase());
		});
		it('Result should have same target currency', function () {
			return result.should.eventually.have.property('to', to.toUpperCase());
		});
		it('Result created_time should be date', function () {
			return result.should.eventually.have.property('created_at').which.is.instanceof(Date);
		});
		it('Result rate should be a string', function () {
			return result.should.eventually.have.property('rate').which.is.a('string');
		});
		it('Result rate is a number', function () {
			return result.then(function (payload) {
				return !isNaN(payload.rate);
			}).should.eventually.be.true;
		});
		it('Result rate round off to 2 decmicals', function () {
			return result.then(function (payload) {
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
			}).should.eventually.have.length.within(0, 2);;
		});
	});
	describe('#query() with invalid input', function () {
		let cxr = new CXR();
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
		let cxr = new CXR('http://localhost/');
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
		let cxr = new CXR('https://wtfismyip.com/json');
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
