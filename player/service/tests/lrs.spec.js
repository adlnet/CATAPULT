const path = require("path");
require("dotenv").config({
    path: path.join(__dirname, "../../.env")
});

const axios = require("axios").default;
const mocha = require("mocha");
const chai = require("chai");
const uuid = require("uuid");

const helpers = require("../plugins/routes/lib/helpers");

describe("Basic LRS Communications", async () => {


    it ("Sends a statement via basic PUT requests to the ADL LRS", async() => {

        let statement = {
            "actor": {
              "name": "Sally Glider",
              "mbox": "mailto:sally@example.com"
            },
            "verb": {
              "id": "http://adlnet.gov/expapi/verbs/experienced",
              "display": { "en-US": "experienced" }
            },
            "object": {
              "id": "http://example.com/activities/solo-hang-gliding",
              "definition": {
                "name": { "en-US": "Solo Hang Gliding" }
              }
            },
            id: uuid.v4()
        };

        let path = "/statements?statementId=" + statement.id;

        console.log("Sending statement ...");

        let res = await helpers.sendDocumentToLRS(path, "PUT", statement);

        chai.expect(res.status).to.be.lessThan(400);
        chai.expect(res.status).to.be.greaterThanOrEqual(200);
    });
});
