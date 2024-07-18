const path = require("path");
require("dotenv").config({
    path: path.join(__dirname, "../../.env")
});

const fs = require("fs");

const helpers = require("../plugins/routes/lib/helpers");
const chai = require("chai");

describe("Libxmljs Usage", async () => {

    /**
     * https://www.stackhawk.com/blog/nodejs-xml-external-entities-xxe-guide-examples-and-prevention/
     */
    const PATH_XML_DOC_ENTITY_USAGE = path.join(__dirname, "files/entity.xml");

    it ("Rejects anything using an ENTITY tag", async() => {
       
        let entityBody = fs.readFileSync(PATH_XML_DOC_ENTITY_USAGE);
        let suspicious = await helpers.isPotentiallyMaliciousXML(entityBody);

        chai.expect(suspicious).to.be.equal(true, "The provided XML should have thrown a validity issue for its use of an <!ENTITY tag");
    });
});
