const { expect } =require('chai'); //utilize chai assertion library 'expect'
const sinon = require('sinon'); //base sinon
const chai = require ("chai"); //base chai
const chaiAsPromised = require("chai-as-promised");
const Registration = require('../service/plugins/routes/lib/registration.js');//So Session is exported, can we get it's function here through this?
//const RegistrationFunctions = require('../service/plugins/routes/lib/registration.js');//So Session is exported, can we get it's function here through this?

const { assert } = require('chai');
const Wreck = require("@hapi/wreck");
const lrs = require("../service/plugins/routes/lrs");

const { v4: uuidv4 } = require("uuid"),
    Boom = require("@hapi/boom");
const registration = require('../service/plugins/routes/lib/registration.js');
const { isSatisfied } = require('../service/plugins/routes/lib/registration.js');
var spy = sinon.spy;
chai.use(chaiAsPromised);
chai.should();

describe('Test of mapMoveOnChildren function', function() {

	var moveOnChildrenSpy, getSessionStub;
	//var child=  sinon.spy(Registration, "");//stand in child object 
	var child = {
          lmsId: 0,
          id: 0,
          pubId: 1,
          type: "au",
          moveOn : "NotApplicable",
          satisfied: true|false,
          children: 0,
          } 
     var testChild

	beforeEach(() =>{
		//getSessionStub = sinon.stub(Session, 'getSession');
		moveOnChildrenSpy = sinon.spy(Registration, "mapMoveOnChildren");

	});

	afterEach(() =>{
		//getSessionStub.reset();
		//getSessionStub.restore();

		moveOnChildrenSpy.restore();
	});

	it('accepts a "child" parameter and maps to its corresponding information', function()  {
		
		testChild =  Registration.mapMoveOnChildren(child);
          
          Registration.mapMoveOnChildren.restore();

		expect(moveOnChildrenSpy.calledOnceWithExactly(child)).to.be.true;

          expect(testChild.lmsId).to.equal(0);
		expect(testChild.pubId).to.equal(0);
          expect(testChild.type).to.equal("au");
          expect(testChild.satisfied).to.equal(true);
	})

	it.skip('if the .type of child is equal to "block", calls the map() to create array of elements and store in .children property', async function (){
		
          child.type ="block";
          
		testChild =  Registration.mapMoveOnChildren(child);
          
          Registration.mapMoveOnChildren.restore();

		expect(moveOnChildrenSpy.calledOnceWithExactly(child)).to.be.true;

          expect(testChild.lmsId).to.equal(0);
		expect(testChild.pubId).to.equal(0);
          expect(testChild.type).to.equal("block");
          expect(testChild.satisfied).to.equal(true);
	})

})

describe('Test of tryParseTemplate function', function() {

	var tptSpy, parseStub;
     var statement; 
     var satisfiedStTemplate ;

     beforeEach(() =>{
		parseStub = sinon.stub(JSON, 'parse')
		tptSpy = sinon.spy(Registration, 'tryParseTemplate');

	});

	afterEach(() =>{
		parseStub.reset();
		parseStub.restore();

          tptSpy.restore();
	});

	it('tries to parse a JSON statement template', async function()  {
		
          parseStub.withArgs(satisfiedStTemplate).returns('a parsed template');
          statement =  Registration.tryParseTemplate(satisfiedStTemplate);

          Registration.tryParseTemplate.restore();
          JSON.parse.restore();
		
          expect(tptSpy.calledOnceWithExactly(satisfiedStTemplate)).to.be.true;

		expect(parseStub.calledOnceWithExactly(satisfiedStTemplate)).to.be.true;

		expect(statement).to.equal('a parsed template');
	})

	it('throws an error if it cannot parse the template',  function (){
		
          parseStub.withArgs(satisfiedStTemplate).rejects();

		try{
			statement =  Registration.tryParseTemplate(satisfiedStTemplate);
			assert.fail(error);//ensure promise was rejected, ie no false positive test
		}
	  	catch (ex) {
			function error () {			
			throw new Error(`Failed to parse statement template: ${ex}`);
			}
			
			//error has to be wrapped and tested here, or it will throw and interrupt test execution
			expect(error).to.throw(`Failed to parse statement template: ${ex}`);
		}

		Registration.tryParseTemplate.restore();
          JSON.parse.restore();

		expect(tptSpy.calledOnceWithExactly(satisfiedStTemplate)).to.be.true;

		expect(parseStub.calledOnceWithExactly(satisfiedStTemplate)).to.be.true;
     })

})

describe('Test of assignStatementValues function', function() {

	var asvSpy, getSessionStub;
	//var child=  sinon.spy(Registration, "");//stand in child object 
	var statement = {
          id: 0,
          timestamp: 0,
          object: {
               id: 0,
               definition: {
                   type: " "
                    }
               },
          moveOn : "NotApplicable",
          context: {
               contextActivities: {
                    grouping: 0
               }
          },
          children: 0,
          }
     var node = {
          lmsId: 0,
          type: "au",
          pubId: 0,
          }  
     var testStatement

	beforeEach(() =>{
		//getSessionStub = sinon.stub(Session, 'getSession');
		asvSpy = sinon.spy(Registration, "assignStatementValues");

	});

	afterEach(() =>{
		//getSessionStub.reset();
		//getSessionStub.restore();

		asvSpy.restore();
	});

	it('assigns statement values from passed in node and statement parameters (called by loopThroughChildren)', function()  {
		
		testStatement =  Registration.assignStatementValues(node, statement);
          
          Registration.assignStatementValues.restore();

		expect(asvSpy.calledOnceWithExactly(node, statement)).to.be.true;

          //expect(testStatement.lmsId).to.equal(lmsId);
          //expect(testStatement.pubId).to.equal(0);
          //expect(testStatement.type).to.equal("au");
          //expect(testStatement.satisfied).to.equal(true);
	})
})
describe('Test of nodeSatisfied function', function() {

	var nodeSatisfiedSpy, getSessionStub;
	//var child=  sinon.spy(Registration, "");//stand in child object 
	
     var node = {
          satisfied : true | false
          }  
     var testNode

	beforeEach(() =>{
		//getSessionStub = sinon.stub(Session, 'getSession');
		nodeSatisfiedSpy = sinon.spy(Registration, "nodeSatisfied");

	});

	afterEach(() =>{
		//getSessionStub.reset();
		//getSessionStub.restore();

		nodeSatisfiedSpy.restore();
	});

	it('returns true if node it is passed satisified property is true (called by isSatisfied)', async function()  {
		
          node.satisfied = true;

		testNode =  await Registration.nodeSatisfied(node);
          
          Registration.nodeSatisfied.restore();

		expect(nodeSatisfiedSpy.calledOnceWithExactly(node)).to.be.true;

          expect(testNode).to.be.true;

          //expect(testStatement.lmsId).to.equal(lmsId);
          //expect(testStatement.pubId).to.equal(0);
          //expect(testStatement.type).to.equal("au");
          //expect(testStatement.satisfied).to.equal(true);
	})
})
describe('Test of AUnodeSatisfied function', function() {

	var auNodeSatisfiedSpy, getSessionStub;
	//var child=  sinon.spy(Registration, "");//stand in child object 
	
     var node = {
          satisfied : true | false,
          type: "",
          lmsId: true|false
          }  
     var testNode, auToSetSatisfied = true|false;

	beforeEach(() =>{
		//getSessionStub = sinon.stub(Session, 'getSession');
		auNodeSatisfiedSpy = sinon.spy(Registration, "AUnodeSatisfied");

	});

	afterEach(() =>{
		//getSessionStub.reset();
		//getSessionStub.restore();

		auNodeSatisfiedSpy.restore();
	});

	it('verifies the nodes "type" property is "au". If so it sets the "lmsId" and "satisified" properties and returns the "satisified property (called by isSatisfied)', async function()  {
		
          node.type = "au";
          node.lmsId =true;
          auToSetSatisfied = true;

		testNode =  await Registration.AUnodeSatisfied(node, {auToSetSatisfied});
          
          Registration.AUnodeSatisfied.restore();

		expect(auNodeSatisfiedSpy.calledOnceWithExactly(node, {auToSetSatisfied})).to.be.true;

          expect(testNode).to.be.true;
	})
})
describe.only('Test of loopThroughChildren function', function() {

	var loopThroughChildrenSpy, isSatisfiedStub;
	var child = {
          lmsId: 0,
          id: 0,
          pubId: 1,
          type: "au",
          moveOn : "NotApplicable",
          satisfied: true|false,
          children: 0,
          auToSetSatisfied :[ 1, 2 ], 
          satisfiedStTemplate :[1, 2], 
          lrsWreck:[1 ,2]
          } 
     var allChildrenSatisfied 
     var  auToSetSatisfied = true|false;
     var satisfiedStTemplate =true|false;
     var lrsWreck = true| false;
     var kid = new Set();
     kid = [1, 2, 3, 4 ,5, 6]
     var node= {children: ["w", "t", "f"] 
     }
     
	beforeEach(() =>{
		isSatisfiedStub = sinon.stub(Registration, "isSatisfied")
          loopThroughChildrenSpy = sinon.spy(Registration, "loopThroughChildren");

	});

	afterEach(() =>{
		isSatisfiedStub.reset();
		isSatisfiedStub.restore();

		loopThroughChildrenSpy.restore();
	});

	it('recursively loops through a node and if any of the nodes children are unsatisified, it marks "allChildrenSatisifed false and returns that value" (called in isSatisifed function)', async function()  {
		auToSetSatisfied = true;
          satisfiedStTemplate = true;
          lrsWreck = true;
          node.children =["w", "t", "f"]
          for(const child of node.children){
               console.log(child)
          }
          console.log("Before calling", isSatisfied)
          isSatisfiedStub.withArgs(child, auToSetSatisfied, satisfiedStTemplate, lrsWreck).resolves( false);
		
          //test = await Registration.loopThroughChildren(node, allChildrenSatisfied, auToSetSatisfied, satisfiedStTemplate, lrsWreck);
          
          allChildrenSatisfied = await Registration.loopThroughChildren(node, auToSetSatisfied, satisfiedStTemplate, lrsWreck);
          
          Registration.loopThroughChildren.restore();
          Registration.isSatisfied.restore();

		expect(loopThroughChildrenSpy.calledOnceWithExactly(node, auToSetSatisfied, satisfiedStTemplate, lrsWreck)).to.be.true;

          expect(allChildrenSatisfied).to.equal(false);
	})

	it.skip('if the .type of child is equal to "block", calls the map() to create array of elements and store in .children property', async function (){
		
          child.type ="block";
          
		testChild =  Registration.mapMoveOnChildren(child);
          
          Registration.mapMoveOnChildren.restore();

		expect(moveOnChildrenSpy.calledOnceWithExactly(child)).to.be.true;

          expect(testChild.lmsId).to.equal(0);
		expect(testChild.pubId).to.equal(0);
          expect(testChild.type).to.equal("block");
          expect(testChild.satisfied).to.equal(true);
	})

})
describe('Test of retrieveResponse function', function() {
   
	var rrSpy, wreckStub;
	var txn = { rollback: ()=> {return true|false}  }; //a transaction object
	var lrsWreck = {request: async (string1, string2) => {return "response received" /*assume request received*/} }
	var satisfiedStResponse ="st response", satisfiedStResponseBody = "st response body"

	beforeEach(() =>{
		rrSpy = sinon.spy(Registration,'retrieveResponse');
		wreckStub =sinon.stub(Wreck, 'read')
	});

	afterEach(() =>{
		rrSpy.restore();

		wreckStub.reset();
		wreckStub.restore();
	});

	it('tries to retrieve and return the response from a POST request to the LRS server', async function()  {
		rrSpy.restore();//this is the only one we want to use a stub for, so take away spy
		rrStub = sinon.stub(Registration, 'retrieveResponse');

		rrStub.withArgs(lrsWreck, txn).resolves([satisfiedStResponse, satisfiedStResponseBody]);
		
		[satisfiedStResponse, satisfiedStResponseBody] = await Registration.retrieveResponse(lrsWreck, txn);
		
		Registration.retrieveResponse.restore();

		expect(satisfiedStResponse).to.equal("st response");
		expect(satisfiedStResponseBody).to.equal("st response body");

		expect(rrStub.calledOnceWithExactly(lrsWreck, txn)).to.be.true;
	});

	it('catches and throws an error if the server information was not retrieved and returned successfully, then rolls back transaction', async function() {
		
		try{
			await Registration.retrieveResponse(lrsWreck, txn);
			assert.fail(error);//ensure promise was rejected, ie no false positive test
		}
	  	catch (ex) {
			
			function error () {	
				txn.rollback = true;		
				throw new Error(`Failed request to store abandoned statement: ${ex}`);
			}
			
			//error has to be wrapped and tested here, or it will throw and interrupt test execution
			expect(error).to.throw(`Failed request to store abandoned statement: ${ex}`);
		}

		Registration.retrieveResponse.restore();
		
		expect(txn.rollback).to.be.true;

		expect(rrSpy.calledOnceWithExactly(lrsWreck, txn)).to.be.true;
	});
})