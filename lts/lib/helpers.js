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

const fs = require("fs"),
    Wreck = require("@hapi/wreck"),
    requirements = require("../../cts/client/src/requirements.json");
let Helpers;

module.exports = Helpers = {
    setupLMS: async (tenantCode) => {
        try {
            await global.LMS.setup(tenantCode);
        }
        catch (ex) {
            throw new Error(`Failed to setup LMS: ${ex}`);
        }
    },

    teardownLMS: async () => {
        if (global.LMS) {
            await global.LMS.teardown();
        }
    },

    req: (id) => requirements[id],
    describeReq: (id) => {
        if (! id) {
            return "";
        }
        if (! Helpers.req(id)) {
            return `Unrecognized requirement: ${id}`;
        }

        return `${id} - ${Helpers.req(id).txt}`;
    },

    getResult: async () => {
        await page.waitForSelector("#result");

        const resultElement = await page.$("#result"),
            resultJSON = await resultElement.evaluate(el => el.textContent);

        let result;
        try {
            result = JSON.parse(resultJSON);
        }
        catch (ex) {
            throw new Error(`Failed to parse JSON from string: '${resultJSON}'`);
        }

        return result;
    },

    loadAU: async (courseId, auIndex, actorAccountName, {registration, launchMode} = {}) => {
        let launchUrl;

        try {
            launchUrl = await global.LMS.getLaunchUrl(
                courseId,
                auIndex,
                {
                    account: {
                        name: actorAccountName,
                        homePage: "https://w3id.org/xapi/cmi5/catapult/lts"
                    }
                },
                {
                    registration,
                    launchMode
                }
            );
        }
        catch (ex) {
            throw new Error(`Failed to get launch URL for course ${courseId} AU ${auIndex}: ${ex}`);
        }

        try {
            await page.goto(launchUrl);
        }
        catch (ex) {
            throw new Error(`Failed to load AU launch url: ${ex}`);
        }
    },

    runAU: async (courseId, auIndex, actorAccountName, cfg) => {
        await Helpers.loadAU(courseId, auIndex, actorAccountName, cfg);

        return Helpers.getResult();
    },

    importPkg: (pkgFileName, contentType) => {
        const fileAsStream = fs.createReadStream(`${__dirname}/../pkg/dist/${pkgFileName}`);

        if (! contentType) {
            contentType = pkgFileName.endsWith(".zip") ? "application/zip" : "text/xml";
        }

        return global.LMS.importCourse(fileAsStream, contentType, pkgFileName);
    },

    importAndRunAU: async (pkgFileName, auIndex) => {
        const courseId = await Helpers.importPkg(pkgFileName);

        return Helpers.runAU(courseId, auIndex, pkgFileName);
    },

    cleanup: () => global.LMS.cleanup(),
    fetchStatements: async ({registration}) => {
        const endpoint = global.LMS.getLrsEndpoint(),
            authHeader = global.LMS.getLrsAuthHeader();

        let response,
            responseBody;

        try {
            response = await Wreck.request(
                "GET",
                `${endpoint}/statements?registration=${registration}&ascending=true`,
                {
                    headers: {
                        "X-Experience-API-Version": "1.0.3",
                        Authorization: authHeader
                    },
                    json: true
                }
            );

            responseBody = await Wreck.read(response, {json: true});
        }
        catch (ex) {
            throw new Error(`Failed to make request to get statements: ${ex}`);
        }

        if (response.statusCode !== 200) {
            if (response.statusCode === 401 || response.statusCode === 403) {
                throw new Error(`4.2.0.0-2 - The LMS MUST have an account which is able to retrieve all Resource data (from the Statement API, etc, including attachments and extensions) about another distinct user across multiple sessions for that user. (${response.statusCode} ${responseBody})`);
            }

            throw new Error(`Failed to get statements: ${response.statusCode} (${responseBody})`);
        }

        return responseBody.statements;
    },

    hasWaive: () => global.LMS.hasWaive(),
    waiveAU: async (registration, auIndex, reason) => {
        if (! global.LMS.hasWaive()) {
            throw new Error("LMS does not implement waiveAU");
        }

        return global.LMS.waiveAU(registration, auIndex, reason);
    },

    hasAbandon: () => global.LMS.hasAbandon(),
    abandonSession: async (sessionId) => {
        if (! global.LMS.hasAbandon()) {
            throw new Error("LMS does not implement abandonSession");
        }

        return global.LMS.abandonSession(sessionId);
    }
};
