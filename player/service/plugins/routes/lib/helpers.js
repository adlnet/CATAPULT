/*
    Copyright 2021 Rustici Software

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/
"use strict";

const Boom = require("@hapi/boom");
const Requirements = require("@cmi5/requirements");
const axios = require("axios").default;
const xmlSanitizer = require("xml-sanitizer");

let user = process.env.LRS_USERNAME;
let pass = process.env.LRS_PASSWORD;

axios.defaults.headers.common = {
    ...axios.defaults.headers.common,

    "Content-Type": "application/json",
    "Authorization": "Basic " + Buffer.from(`${user}:${pass}`).toString("base64"),
    "X-Experience-API-Version": (process.env.LRS_XAPI_VERSION || "1.0.3")
};

module.exports = {
    buildViolatedReqId: (violatedReqId, msg, boomType = "forbidden") => {
        if (! Requirements[violatedReqId]) {
            throw new Error(`Unrecognized requirement id: ${violatedReqId}`);
        }

        return Boom[boomType](`${violatedReqId} - ${Requirements[violatedReqId].txt} (${msg})`, {violatedReqId});
    },

    /**
     * @typedef LRSDocumentResult
     * @property {Object} document
     * @property {Boolean} exists
     * @property {Number} status
     * @property {String} etag
     */
    /**
     * Get a document from the configured LRS
     * @param {String} resourcePath Path of the xAPI resource relative to your LRS root.
     * @returns {Promise<LRSDocumentResult>}
     */
    getDocumentFromLRS: async(resourcePath) => {

        let endpoint = process.env.LRS_ENDPOINT;
        if (endpoint.endsWith("/") == false)
            endpoint += "/";

        if (resourcePath.startsWith("/"))
            resourcePath = resourcePath.substring(1);

        let documentResponse = await axios.get(endpoint + resourcePath).catch(err => err.response);
        let documentExists = documentResponse.status >= 200 && documentResponse.status < 400;
        let documentBody = documentExists ? await documentResponse.data : null;

        return {
            etag: documentResponse.headers["etag"],
            exists: documentExists,
            status: documentResponse.status,
            document: documentBody
        }
    },

    /**
     * @typedef LRSDocumentSendResult
     * @property {Boolean} success
     * @property {String} etag
     * @property {Object} responseBody
     * @property {Number} status Numeric status code.
     * @property {String} statusText Status text for the response.
     * @property {Object} res Axios response for this.
     */
    /**
     * Send a document to the configured LRS
     * @param {String} resourcePath Path of the xAPI resource relative to your LRS root.
     * @param {String} method HTTP method for this request.
     * @param {Object} payload The document to send.
     * @returns {Promise<LRSDocumentSendResult>}
     */
    sendDocumentToLRS: async(resourcePath, method, payload) => {

        let endpoint = process.env.LRS_ENDPOINT;
        if (endpoint.endsWith("/") == false)
            endpoint += "/";

        if (resourcePath.startsWith("/"))
            resourcePath = resourcePath.substring(1);

        let documentResponse = await axios.request({
            method: method,
            url: endpoint + resourcePath,
            data: payload
        });

        let success = documentResponse.status >= 200 && documentResponse.status < 400;
        let etag = success ? documentResponse.headers["etag"] : undefined;

        console.log(success);

        return {
            etag: etag,
            status: documentResponse.status,
            statusText: documentResponse.statusText,
            success: success,
            responseBody: await documentResponse.data,

            res: documentResponse,
        }
    },

    /**
     * 
     * @param {String} resourcePath 
     * @returns 
     */
    doesLRSResourceEnforceConcurrency: (resourcePath) => {

        const concurrencyPaths = [
            "activities/state",
            "activities/profile",
            "agents/profile"
        ];

        return concurrencyPaths.includes(resourcePath);
    },

    /**
     * Checks the given XML content, returning false if the content
     * appears potentially malicious.
     * @param {String|Buffer} xmlContent 
     */
    isPotentiallyMaliciousXML: async(xmlContent) => {

        if (xmlContent.includes("<!ENTITY")) {
            console.error(">> Invalid XML -- Attempts an Entity Tag: ", "\n--------------\n", xmlContent);
            return true;
        }
        
        return false;
    },

    /**
     * Attempts to sanitize the given content, throwing an error if the provided
     * content is neither a string nor a Buffer.
     * 
     * @param {String|Buffer} xmlContent 
     */
    sanitizeXML: async(xmlContent) => {
        if (typeof xmlContent === "string")
            return xmlSanitizer(xmlContent);
        else if (Buffer.isBuffer(xmlContent))
            return xmlSanitizer(xmlContent.toString());
        else
            console.error("helpers.sanitizeXML requires either a string or a Buffer -- received: " + typeof xmlContent);

        return undefined;
    }
};
