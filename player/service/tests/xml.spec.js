const path = require("path");
require("dotenv").config({
    path: path.join(__dirname, "../../.env")
});

const fs = require("fs");

const helpers = require("../plugins/routes/lib/helpers");
const chai = require("chai");
const mocha = require("mocha");
const exp = require("constants");

describe("XML Parsing and Usage", async () => {

    /**
     * https://www.stackhawk.com/blog/nodejs-xml-external-entities-xxe-guide-examples-and-prevention/
     */
    const PATH_XML_DOC_ENTITY_USAGE = path.join(__dirname, "files/entity.xml");

    it ("Rejects anything using an ENTITY tag", async() => {
       
        let entityBody = fs.readFileSync(PATH_XML_DOC_ENTITY_USAGE);
        let suspicious = await helpers.isPotentiallyMaliciousXML(entityBody);

        chai.expect(suspicious).to.be.equal(true, "The provided XML should have thrown a validity issue for its use of an <!ENTITY tag");
    });

    it ("Sanitizes malicious characters out of the XML body", async() => {

        let providedText = '\u0000Some text\u0000🎉🎉\u0000';
        let expectedText = 'Some text';

        let parsedText = await helpers.sanitizeXML(providedText);

        chai.expect(parsedText).to.be.equal(expectedText, "The provided XML was not parsed into the expected text");
    });


    it ("Handles when a Buffer is provided instead of a string", async() => {

        let providedText = '\u0000Some text\u0000🎉🎉\u0000';
        let providedBuffer = Buffer.from(providedText);
        let expectedText = 'Some text';

        let parsedText = await helpers.sanitizeXML(providedBuffer);

        chai.expect(parsedText).to.be.equal(expectedText, "The provided XML was not parsed into the expected text");
    });
});
