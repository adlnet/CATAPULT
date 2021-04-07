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
    util = require("util"),
    Boom = require("@hapi/boom"),
    Wreck = require("@hapi/wreck"),
    xml2js = require("xml2js"),
    StreamZip = require("node-stream-zip"),
    { v4: uuidv4 } = require("uuid"),
    readFile = util.promisify(fs.readFile),
    copyFile = util.promisify(fs.copyFile),
    mkdir = util.promisify(fs.mkdir),
    validateAU = (element) => {
        const result = {
            type: "au",
            id: element.$.id
        };

        if (element.title && element.title.length > 0) {
            result.title = element.title[0].langstring.map(
                (ls) => ({
                    lang: ls.$.lang,
                    text: ls._
                })
            );
        }
        if (element.description && element.description.length > 0) {
            result.description = element.description[0].langstring.map(
                (ls) => ({
                    lang: ls.$.lang,
                    text: ls._
                })
            );
        }
        if (element.url && element.url.length > 0) {
            result.url = element.url;
        }
        else {
            throw new Error("Invalid AU: 'url' missing or zero length");
        }

        return result;
    },
    validateBlock = (element) => {
        const result = {
            type: "block",
            id: element.$.id,
            children: []
        };

        if (element.title && element.title.length > 0) {
            result.title = element.title[0].langstring.map(
                (ls) => ({
                    lang: ls.$.lang,
                    text: ls._
                })
            );
        }
        if (element.description && element.description.length > 0) {
            result.description = element.description[0].langstring.map(
                (ls) => ({
                    lang: ls.$.lang,
                    text: ls._
                })
            );
        }

        for (const child of element.$$) {
            if (child["#name"] === "au") {
                result.children.push(
                    validateAU(child)
                );
            }
            else if (child["#name"] === "block") {
                result.children.push(
                    validateBlock(child)
                );
            }
            else if (child["#name"] === "objectives") {
            }
            else {
                console.log("Unrecognized element: ", element);
            }
        }

        return result;
    },
    validateAndReduceStructure = (structure) => {
        const result = {
            course: {
                type: "course",
                children: [],
                objectives: null
            }
        };

        if (! structure.courseStructure) {
            throw new Error(`No "courseStructure" element`);
        }

        const _course = structure.courseStructure.course[0];

        result.course.id = _course.$.id;

        if (_course.title && _course.title.length > 0) {
            result.course.title = _course.title[0].langstring.map(
                (ls) => ({
                    lang: ls.$.lang,
                    text: ls._
                })
            );
        }
        if (_course.description && _course.description.length > 0) {
            result.course.description = _course.description[0].langstring.map(
                (ls) => ({
                    lang: ls.$.lang,
                    text: ls._
                })
            );
        }

        for (const element of structure.courseStructure.$$) {
            // have already handled the course element
            if (element["#name"] === "course") {
                continue;
            }
            // objectives is a single static list
            else if (element["#name"] === "objectives") {
            }
            else if (element["#name"] === "au") {
                result.course.children.push(
                    validateAU(element)
                );
            }
            else if (element["#name"] === "block") {
                result.course.children.push(
                    validateBlock(element)
                );
            }
            else {
                throw new Error(`Unrecognized element: ${element["#name"]}`);
            }
        }

        return result;
    },
    flattenAUs = (list) => {
        const result = [];

        for (const child of list) {
            if (child.type === "au") {
                result.push(child);
            }
            else if (child.type === "block") {
                result.push(
                    ...flattenAUs(child.children)
                );
            }
        }

        return result;
    };

module.exports = {
    name: "catapult-player-api-routes-v1-courses",
    register: (server, options) => {
        server.route(
            [
                {
                    method: "POST",
                    path: "/course",
                    options: {
                        payload: {
                            allow: [
                                "application/zip",
                                "application/xml"
                            ],
                            output: "file"
                        }
                    },
                    handler: async (req, h) => {
                        const db = req.server.app.db,
                            lmsId = `http://catapult/${uuidv4()}`,
                            contentType = req.headers["content-type"],
                            xmlParser = new xml2js.Parser(
                                {
                                    explicitChildren: true,
                                    preserveChildrenOrder: true
                                }
                            );

                        let structureAsXml,
                            zip;

                        try {
                            if (contentType === "application/zip") {
                                zip = new StreamZip.async({file: req.payload.path});

                                structureAsXml = await zip.entryData("cmi5.xml");
                            }
                            else {
                                structureAsXml = await readFile(req.payload.path);
                            }
                        }
                        catch (ex) {
                            throw Boom.internal(`Failed to read structure file: ${ex}`);
                        }

                        let structure;

                        try {
                            structure = await xmlParser.parseStringPromise(structureAsXml);
                        }
                        catch (ex) {
                            throw Boom.badRequest(`Failed to parse XML: ${ex}`);
                        }

                        try {
                            structure = validateAndReduceStructure(structure);
                        }
                        catch (ex) {
                            throw Boom.badRequest(`Failed to validate course structure XML: ${ex}`);
                        }

                        let aus;

                        try {
                            aus = flattenAUs(structure.course.children);
                        }
                        catch (ex) {
                            throw Boom.internal(`Failed to flatten AUs: ${ex}`);
                        }

                        let courseId;

                        try {
                            courseId = await db.insert(
                                {
                                    tenant_id: 1,
                                    lms_id: lmsId,
                                    metadata: JSON.stringify({
                                        version: 1,
                                        aus
                                    }),
                                    structure: JSON.stringify({
                                        version: "1.0.0",
                                        ...structure
                                    })
                                }
                            ).into("courses");
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed to insert: ${ex}`));
                        }

                        const courseDir = `${__dirname}/../../../var/content/${courseId}`;

                        try {
                            await mkdir(courseDir);
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed to create course content directory (${courseDir}): ${ex}`));
                        }

                        try {
                            if (contentType === "application/zip") {
                                await zip.extract(null, courseDir);
                            }
                            else {
                                await copyFile(req.payload.path, `${courseDir}/cmi5.xml`);
                            }
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed to store course content: ${ex}`));
                        }

                        return db.first("*").from("courses").where("id", courseId);
                    }
                },

                {
                    method: "GET",
                    path: "/course/{id}",
                    handler: async (req, h) => {
                        const result = await req.server.app.db.first("*").from("courses").queryContext({jsonCols: ["metadata", "structure"]}).where("id", req.params.id);

                        if (! result) {
                            return Boom.notFound();
                        }

                        return result;
                    }
                },

                {
                    method: "DELETE",
                    path: "/course/{id}",
                    handler: async (req, h) => {
                        try {
                            const deleteResult = await req.server.app.db("courses").where("id", req.params.id).delete();
                        }
                        catch (ex) {
                            throw new Boom.internal(`Failed to delete course (${req.params.id}): ${ex}`);
                        }

                        // TODO: clean up local files

                        return null;
                    }
                },

                {
                    method: "POST",
                    path: "/courses/{id}/launch-url/{auIndex}",
                    handler: async (req, h) => {
                        console.log(`POST /courses/${req.params.id}/launch-url/${req.params.auIndex}`, req.payload.reg);
                        const db = req.server.app.db,
                            regCode = req.payload.reg,
                            tenantId = 1,
                            course = await req.server.app.db.first("*").queryContext({jsonCols: ["metadata", "structure"]}).from("courses").where(
                                {
                                    tenantId,
                                    id: req.params.id
                                }
                            );

                        if (! course) {
                            throw Boom.notFound(`Unrecognized course: ${req.params.id} (${tenantId})`);
                        }

                        let reg;

                        if (regCode) {
                            // load registration record and validate details match
                            reg = await db.first("*").from("registrations").where(
                                {
                                    tenantId,
                                    code: regCode,
                                    courseId: req.params.id
                                }
                            );
                        }

                        if (! reg) {
                            // either this is a new registration or we didn't find one they were expecting
                            // so go ahead and create the registration now
                            reg = {
                                code: uuidv4(),
                                tenant_id: tenantId,
                                course_id: req.payload.courseId,
                                actor: req.payload.actor
                            };

                            let insertResult;

                            try {
                                insertResult = await db.insert(reg).into("registrations");

                                reg.id = insertResult;
                            }
                            catch (ex) {
                                throw Boom.internal(new Error(`Failed to insert into registrations: ${ex}`));
                            }
                        }

                        const actor = reg.actor,
                            lmsActivityId = course.lmsId,
                            publisherActivityId = course.structure.course.id,
                            launchMode = "Normal",
                            launchMethod = "AnyWindow",
                            moveOn = "Completed",
                            baseUrl = `${req.url.protocol}//${req.url.host}`,
                            endpoint = `${baseUrl}/lrs`,
                            returnURL = `${baseUrl}/return-url`,
                            lrsWreck = Wreck.defaults(
                                {
                                    baseUrl: req.server.app.lrs.endpoint,
                                    headers: {
                                        "X-Experience-API-Version": "1.0.3",
                                        Authorization: `Basic ${Buffer.from(`${req.server.app.lrs.username}:${req.server.app.lrs.password}`).toString("base64")}`
                                    },
                                    json: true
                                }
                            ),
                            sessionId = uuidv4(),
                            contextTemplate = {
                                contextActivities: {
                                    grouping: [
                                        {
                                            id: publisherActivityId
                                        }
                                    ]
                                },
                                extensions: {
                                    "https://w3id.org/xapi/cmi5/context/extensions/sessionid": sessionId
                                }
                            };

                        let contentUrl;

                        if (/[A-Za-z]+:\/\/.+/.test(course.metadata.aus[req.params.auIndex].url)) {
                            contentUrl = course.metadata.aus[req.params.auIndex].url;
                        }
                        else {
                            contentUrl = `${req.server.app.contentUrl}/${course.id}/${course.metadata.aus[req.params.auIndex].url}`;
                        }

                        let lmsLaunchDataResponse;

                        try {
                            const lmsLaunchDataStateParams = new URLSearchParams(
                                {
                                    stateId: "LMS.LaunchData",
                                    agent: actor,
                                    activityId: lmsActivityId,
                                    registration: regCode
                                }
                            );

                            lmsLaunchDataResponse = await lrsWreck.request(
                                "POST",
                                `activities/state?${lmsLaunchDataStateParams.toString()}`,
                                {
                                    headers: {
                                        "Content-Type": "application/json"
                                    },
                                    payload: {
                                        launchMode,
                                        launchMethod,
                                        moveOn,
                                        returnURL,
                                        contextTemplate
                                    }
                                }
                            );
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed request to set LMS.LaunchData state document: ${ex}`));
                        }

                        if (lmsLaunchDataResponse.statusCode !== 204) {
                            throw Boom.internal(new Error(`Failed to store LMS.LaunchData state document: ${lmsLaunchDataResponse.statusCode}`));
                        }

                        let launchedStResponse,
                            launchedStResponseBody;

                        try {
                            const launchedStContext = {
                                ...contextTemplate,
                                registration: regCode,
                                extensions: {
                                    "https://w3id.org/xapi/cmi5/context/extensions/sessionid": sessionId,
                                    "https://w3id.org/xapi/cmi5/context/extensions/launchmode": launchMode,
                                    "https://w3id.org/xapi/cmi5/context/extensions/moveon": moveOn,
                                    "https://w3id.org/xapi/cmi5/context/extensions/launchurl": contentUrl
                                }
                            };

                            launchedStContext.contextActivities.category = [
                                {
                                    id: "https://w3id.org/xapi/cmi5/context/categories/cmi5"
                                }
                            ];

                            launchedStResponse = await lrsWreck.request(
                                "POST",
                                "statements",
                                {
                                    headers: {
                                        "Content-Type": "application/json"
                                    },
                                    payload: {
                                        actor: JSON.parse(actor),
                                        verb: {
                                            id: "http://adlnet.gov/expapi/verbs/launched",
                                            display: {
                                                en: "launched"
                                            }
                                        },
                                        object: {
                                            id: lmsActivityId
                                        },
                                        context: launchedStContext
                                    }
                                }
                            );

                            launchedStResponseBody = await Wreck.read(launchedStResponse, {json: true});
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed request to store launched statement: ${ex}`));
                        }

                        if (launchedStResponse.statusCode !== 200) {
                            throw Boom.internal(new Error(`Failed to store launched statement: ${launchedStResponse.statusCode}`));
                        }

                        let sessionInsertResult;
                        const session = {
                            tenantId: tenantId,
                            registrationId: reg.id,
                            isLaunched: true,
                            launchMode,
                            launchTokenId: uuidv4()
                        };

                        try {
                            sessionInsertResult = await db.insert(session).into("sessions");

                            session.id = sessionInsertResult[0];
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed to insert session: ${ex}`));
                        }

                        const launchUrlParams = new URLSearchParams(
                            {
                                endpoint,
                                fetch: `${baseUrl}/fetch-url`,
                                actor,
                                activityId: lmsActivityId,
                                registration: regCode
                            }
                        );

                        return {
                            id: session.id,
                            url: `${contentUrl}?${launchUrlParams.toString()}`
                        };
                    }
                }
            ]
        );
    }
};
