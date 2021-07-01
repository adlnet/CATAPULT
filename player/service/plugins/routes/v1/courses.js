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
    libxml = require("libxmljs"),
    StreamZip = require("node-stream-zip"),
    iri = require("iri"),
    { v4: uuidv4 } = require("uuid"),
    url = require("url"),
    Registration = require("./lib/registration"),
    Hoek = require("@hapi/hoek"),
    readFile = util.promisify(fs.readFile),
    copyFile = util.promisify(fs.copyFile),
    mkdir = util.promisify(fs.mkdir),
    rm = util.promisify(fs.rm),
    schema = libxml.parseXml(fs.readFileSync(`${__dirname}/../../../xsd/v1/CourseStructure.xsd`)),
    schemaNS = "https://w3id.org/xapi/profiles/cmi5/v1/CourseStructure.xsd",
    validateIRI = (input) => {
        const resolved = new iri.IRI(input).toAbsolute();

        return true;
    },
    validateObjectiveRefs = (objectiveRefs, objectiveMap) => {
        for (const objElement of objectiveRefs.childNodes()) {
            const idref = objElement.attr("idref").value();

            if (! objectiveMap[idref]) {
                throw new Error(`Invalid objective idref (${idref}): not found in objective map`);
            }
        }
    },
    validateAU = (element, lmsIdHelper, objectiveMap) => {
        const result = {
                type: "au",
                id: element.attr("id").value(),
                lmsId: `${lmsIdHelper.prefix}/au/${lmsIdHelper.auIndex++}`,
                objectives: null
            },
            auTitle = element.get("xmlns:title", schemaNS),
            auDesc = element.get("xmlns:description", schemaNS),
            objectiveRefs = element.get("xmlns:objectives", schemaNS);

        validateIRI(result.id);

        result.title = auTitle.childNodes().map(
            (ls) => ({
                lang: ls.attr("lang").value(),
                text: ls.text().trim()
            })
        );
        result.description = auDesc.childNodes().map(
            (ls) => ({
                lang: ls.attr("lang").value(),
                text: ls.text().trim()
            })
        );

        if (objectiveRefs) {
            validateObjectiveRefs(objectiveRefs, objectiveMap);
        }

        result.url = element.get("xmlns:url", schemaNS).text().trim();

        result.launchMethod = element.attr("launchMethod") ? element.attr("launchMethod").value() : "AnyWindow";
        result.moveOn = element.attr("moveOn") ? element.attr("moveOn").value() : "NotApplicable";
        result.masteryScore = element.attr("masteryScore") ? Number.parseFloat(element.attr("masteryScore").value()) : null;
        result.activityType = element.attr("activityType") ? element.attr("activityType").value() : null;

        const launchParameters = element.get("xmlns:launchParameters", schemaNS),
            entitlementKey = element.get("xmlns:entitlementKey", schemaNS);

        if (launchParameters) {
            result.launchParameters = launchParameters.text().trim();
        }
        if (entitlementKey) {
            result.entitlementKey = entitlementKey.text().trim();
        }

        return result;
    },
    validateBlock = (element, lmsIdHelper, objectiveMap) => {
        const result = {
                type: "block",
                id: element.attr("id").value(),
                lmsId: `${lmsIdHelper.prefix}/block/${lmsIdHelper.blockIndex++}`,
                children: [],
                objectives: null
            },
            blockTitle = element.get("xmlns:title", schemaNS),
            blockDesc = element.get("xmlns:description", schemaNS),
            objectiveRefs = element.get("xmlns:objectives", schemaNS);

        validateIRI(result.id);

        result.title = blockTitle.childNodes().map(
            (ls) => ({
                lang: ls.attr("lang").value(),
                text: ls.text().trim()
            })
        );
        result.description = blockDesc.childNodes().map(
            (ls) => ({
                lang: ls.attr("lang").value(),
                text: ls.text().trim()
            })
        );

        if (objectiveRefs) {
            validateObjectiveRefs(objectiveRefs, objectiveMap);
        }

        for (const child of element.childNodes()) {
            if (child.name() === "au") {
                result.children.push(
                    validateAU(child, lmsIdHelper, objectiveMap)
                );
            }
            else if (child.name() === "block") {
                result.children.push(
                    validateBlock(child, lmsIdHelper, objectiveMap)
                );
            }
            else if (child.name() === "objectives") {
            }
        }

        return result;
    },
    validateAndReduceStructure = (document, lmsId) => {
        const result = {
                course: {
                    type: "course",
                    lmsId,
                    children: [],
                    objectives: null
                }
            },
            courseStructure = document.root(),
            course = courseStructure.get("xmlns:course", schemaNS),
            courseTitle = course.get("xmlns:title", schemaNS),
            courseDesc = course.get("xmlns:description", schemaNS),
            objectives = courseStructure.get("xmlns:objectives", schemaNS),
            lmsIdHelper = {
                prefix: lmsId,
                auIndex: 0,
                blockIndex: 0
            };

        result.course.id = course.attr("id").value();

        validateIRI(result.course.id);

        result.course.title = courseTitle.childNodes().map(
            (ls) => ({
                lang: ls.attr("lang").value(),
                text: ls.text().trim()
            })
        );
        result.course.description = courseDesc.childNodes().map(
            (ls) => ({
                lang: ls.attr("lang").value(),
                text: ls.text().trim()
            })
        );

        if (objectives) {
            result.course.objectives = {};

            for (const objElement of objectives.childNodes()) {
                if (objElement.name() === "objective") {
                    const id = objElement.attr("id").value();

                    validateIRI(id);

                    if (result.course.objectives[id]) {
                        throw new Error(`Invalid objective id (${id}: duplicate not allowed`);
                    }

                    result.course.objectives[id] = {
                        title: objElement.get("xmlns:title", schemaNS).childNodes().map(
                            (ls) => ({
                                lang: ls.attr("lang").value(),
                                text: ls.text().trim()
                            })
                        ),
                        description: objElement.get("xmlns:description", schemaNS).childNodes().map(
                            (ls) => ({
                                lang: ls.attr("lang").value(),
                                text: ls.text().trim()
                            })
                        )
                    };
                }
            }
        }

        for (const element of courseStructure.childNodes()) {
            if (element.name() === "au") {
                result.course.children.push(
                    validateAU(element, lmsIdHelper, result.course.objectives)
                );
            }
            else if (element.name() === "block") {
                result.course.children.push(
                    validateBlock(element, lmsIdHelper, result.course.objectives)
                );
            }
            else {
                // shouldn't need to handle unknown elements since the XSD
                // checks should have caught them, anything else is handled
                // directly above (course, objectives)
                // throw new Error(`Unrecognized element: ${element.name()}`);
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
    },
    getCourseDir = (tenantId, courseId) => `${__dirname}/../../../var/content/${tenantId}/${courseId}`;

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
                            // arbitrarily chosen large number (480 MB)
                            maxBytes: 1024 * 1024 * 480,
                            allow: [
                                "application/zip",
                                "text/xml"
                            ],
                            output: "file"
                        },
                        tags: ["api"],
                        ext: {
                            onPostResponse: {
                                method: (req) => {
                                    if (req.payload.path) {
                                        rm(req.payload.path).then(
                                            (err) => {
                                                if (err) {
                                                    console.log(`Failed to clean up payload.path: ${err}`);
                                                }
                                                // nothing to do if it works
                                            }
                                        );
                                    }
                                }
                            }
                        }
                    },
                    handler: async (req, h) => {
                        const db = req.server.app.db,
                            tenantId = req.auth.credentials.tenantId,
                            lmsId = `https://w3id.org/xapi/cmi5/catapult/player/course/${uuidv4()}`,
                            contentType = req.headers["content-type"];

                        let courseStructureData,
                            zip;

                        try {
                            if (contentType === "application/zip") {
                                zip = new StreamZip.async({file: req.payload.path});

                                courseStructureData = await zip.entryData("cmi5.xml");
                            }
                            else {
                                courseStructureData = await readFile(req.payload.path);
                            }
                        }
                        catch (ex) {
                            throw Boom.internal(`Failed to read structure file: ${ex}`);
                        }

                        let courseStructureDocument;

                        try {
                            courseStructureDocument = libxml.parseXml(
                                courseStructureData,
                                {
                                    noblanks: true,
                                    noent: true,
                                    nonet: true
                                }
                            );
                        }
                        catch (ex) {
                            throw Boom.badRequest(`Failed to parse XML data: ${ex}`);
                        }

                        let validationResult;

                        try {
                            validationResult = courseStructureDocument.validate(schema);
                        }
                        catch (ex) {
                            throw Boom.internal(`Failed to validate course structure against schema: ${ex}`);
                        }

                        if (! validationResult) {
                            throw Boom.badRequest(`Invalid course structure data (schema violation): ${courseStructureDocument.validationErrors.join(",")}`);
                        }

                        let structure;

                        try {
                            structure = validateAndReduceStructure(courseStructureDocument, lmsId, zip ? true : false);
                        }
                        catch (ex) {
                            throw Boom.badRequest(`Failed to validate course structure: ${ex}`);
                        }

                        let aus;

                        try {
                            aus = flattenAUs(structure.course.children);
                        }
                        catch (ex) {
                            throw Boom.internal(`Failed to flatten AUs: ${ex}`);
                        }

                        //
                        // review all AUs to confirm their URLs are conformant and for
                        // relative URLs make sure they are from a zip and that there
                        // is an entry in the zip for that URL
                        //
                        for (const au of aus) {
                            let launchUrl;
                            try {
                                //
                                // using the legacy URL support because it allows relative URLs
                                // but the newer WHAT-WG API doesn't, see the following issues for details
                                // https://github.com/nodejs/node/issues/12682
                                // https://github.com/whatwg/url/issues/531
                                //
                                launchUrl = url.parse(au.url, true);
                            }
                            catch (ex) {
                                throw new Error(`13.1.4.0-2 - Regardless of the value of "scheme", the remaining portion of the URL ["au" element "url" attribute] MUST conform to RFC1738 - Uniform Resource Locators (URL). '${result.url}': ${ex}`);
                            }

                            for (const k of ["endpoint", "fetch", "actor", "activityId", "registration"]) {
                                if (typeof launchUrl.query[k] !== "undefined") {
                                    throw new Error(`8.1.0.0-6 - If the AU's URL requires a query string for other purposes, then the names MUST NOT collide with named parameters defined below ["endpoint", "fetch", "actor", "activityId", "registration"]. (${k})`);
                                }
                            }

                            if (launchUrl.protocol === null || launchUrl.host === null) {
                                if (! zip) {
                                    throw new Error(`14.2.0.0-1 - When a course structure XML file is provided without a ZIP file package, all URL references MUST be fully qualified.`);
                                }

                                const zipEntry = await zip.entry(launchUrl.pathname);
                                if (! zipEntry) {
                                    throw new Error(`14.1.0.0-4 - Any media not included in a ZIP course package MUST use fully qualified URL references in the Course Structure XML. (${launchUrl.pathname} not found in zip)`);
                                }
                            }
                        }

                        let courseId;

                        try {
                            await db.transaction(
                                async (trx) => {
                                    courseId = await trx("courses").insert(
                                        {
                                            tenantId,
                                            lmsId,
                                            metadata: JSON.stringify({
                                                version: 1,
                                                aus
                                            }),
                                            structure: JSON.stringify({
                                                version: "1.0.0",
                                                ...structure
                                            })
                                        }
                                    );

                                    await trx("courses_aus").insert(
                                        aus.map(
                                            (au, i) => ({
                                                tenantId,
                                                courseId,
                                                auIndex: i,
                                                lmsId: au.lmsId,
                                                metadata: JSON.stringify({
                                                    version: 1,
                                                    launchMethod: au.launchMethod,
                                                    launchParameters: au.launchParameters,
                                                    moveOn: au.moveOn,
                                                    masteryScore: au.masteryScore,
                                                    entitlementKey: au.entitlementKey
                                                })
                                            })
                                        )
                                    );
                                }
                            );
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed to insert: ${ex}`));
                        }

                        const courseDir = getCourseDir(tenantId, courseId);

                        try {
                            await mkdir(courseDir, {recursive: true});
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

                        return db.first("*").from("courses").where({tenantId: req.auth.credentials.tenantId, id: courseId});
                    }
                },

                {
                    method: "GET",
                    path: "/course/{id}",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        const result = await req.server.app.db.first("*").from("courses").queryContext({jsonCols: ["metadata", "structure"]}).where({tenantId: req.auth.credentials.tenantId, id: req.params.id});

                        if (! result) {
                            return Boom.notFound();
                        }

                        return result;
                    }
                },

                {
                    method: "DELETE",
                    path: "/course/{id}",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        const tenantId = req.auth.credentials.tenantId,
                            courseId = req.params.id;

                        try {
                            await rm(
                                getCourseDir(tenantId, courseId),
                                {
                                    force: true,
                                    recursive: true
                                }
                            );
                        }
                        catch (ex) {
                            throw new Boom.internal(`Failed to delete course files (${courseId}): ${ex}`);
                        }

                        try {
                            await req.server.app.db("courses").where({tenantId, id: courseId}).delete();
                        }
                        catch (ex) {
                            throw new Boom.internal(`Failed to delete course (${courseId}): ${ex}`);
                        }

                        return null;
                    }
                },

                {
                    method: "POST",
                    path: "/course/{id}/launch-url/{auIndex}",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        console.log(`POST /courses/${req.params.id}/launch-url/${req.params.auIndex}`, req.payload.reg);
                        const db = req.server.app.db,
                            courseId = req.params.id,
                            auIndex = req.params.auIndex,
                            actor = req.payload.actor,
                            code = req.payload.reg,
                            tenantId = req.auth.credentials.tenantId,
                            course = await db.first("*").queryContext({jsonCols: ["metadata", "structure"]}).from("courses").where(
                                {
                                    tenantId,
                                    id: courseId
                                }
                            );

                        if (! course) {
                            throw Boom.notFound(`Unrecognized course: ${courseId} (${tenantId})`);
                        }

                        let registrationId;

                        if (code) {
                            // check for registration record and validate details match
                            const selectResult = await db.first("id", "actor").queryContext({jsonCols: ["actor"]}).from("registrations").where(
                                {
                                    tenantId,
                                    courseId,
                                    code
                                }
                            );

                            if (selectResult && selectResult.actor.account.name === actor.account.name && selectResult.actor.account.homePage === actor.account.homePage) {
                                registrationId = selectResult.id;
                            }
                        }

                        if (! registrationId) {
                            // either this is a new registration or we didn't find one they were expecting
                            // so go ahead and create the registration now
                            registrationId = await Registration.create(
                                {
                                    tenantId,
                                    courseId,
                                    actor,
                                    code
                                },
                                {db}
                            );
                        }

                        const reg = await Registration.load({tenantId, registrationId}, {db}),
                            {registrationsCoursesAus: regCourseAu, coursesAus: courseAu} = await db
                                .first("*")
                                .queryContext({jsonCols: ["registrations_courses_aus.metadata", "courses_aus.metadata"]})
                                .from("registrations_courses_aus")
                                .leftJoin("courses_aus", "registrations_courses_aus.course_au_id", "courses_aus.id")
                                .where(
                                    {
                                        "registrations_courses_aus.tenant_id": tenantId,
                                        "registrations_courses_aus.registration_id": registrationId,
                                        "courses_aus.au_index": auIndex
                                    }
                                )
                                .options({nestTables: true});

                        let contextTemplateAdditions = req.payload.contextTemplateAdditions.trim();

                        if (contextTemplateAdditions !== "") {
                            try {
                                contextTemplateAdditions = JSON.parse(contextTemplateAdditions);
                            }
                            catch (ex) {
                                throw Boom.internal(new Error(`Context template additions is not valid JSON: ${ex}`));
                            }
                        }

                        const lmsActivityId = courseAu.lms_id,
                            publisherActivityId = course.metadata.aus[auIndex].id,
                            launchMode = req.payload.launchMode || (regCourseAu.is_satisfied ? "Review" : "Normal"),
                            launchMethod = req.payload.launchMethod ? req.payload.launchMethod : (courseAu.metadata.launchMethod === "OwnWindow" ? "newWindow" : "iframe"),
                            launchParameters = req.payload.launchParameters || courseAu.metadata.launchParameters,
                            masteryScore = req.payload.masteryScore || courseAu.metadata.masteryScore,
                            moveOn = req.payload.moveOn || courseAu.metadata.moveOn || "NotApplicable",
                            alternateEntitlementKey = req.payload.alternateEntitlementKey || courseAu.metadata.alternateEntitlementKey,
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

                        if (contextTemplateAdditions !== "") {
                            Hoek.merge(contextTemplate, contextTemplateAdditions, {nullOverride: false});
                        }

                        let contentUrl;

                        if (/[A-Za-z]+:\/\/.+/.test(course.metadata.aus[auIndex].url)) {
                            contentUrl = course.metadata.aus[auIndex].url;
                        }
                        else {
                            contentUrl = `${req.server.app.contentUrl}/${req.auth.credentials.tenantId}/${course.id}/${course.metadata.aus[auIndex].url}`;
                        }

                        let lmsLaunchDataResponse,
                            lmsLaunchDataResponseBody;

                        try {
                            const lmsLaunchDataStateParams = new URLSearchParams(
                                    {
                                        stateId: "LMS.LaunchData",
                                        agent: JSON.stringify(actor),
                                        activityId: lmsActivityId,
                                        registration: reg.code
                                    }
                                ),
                                lmsLaunchDataPayload = {
                                    launchMode,
                                    masteryScore,
                                    moveOn,
                                    launchParameters,
                                    contextTemplate
                                };

                            if (courseAu.metadata.entitlementKey) {
                                lmsLaunchDataPayload.entitlementKey = {
                                    courseStructure: courseAu.metadata.entitlementKey
                                };
                            }

                            if (alternateEntitlementKey !== null) {
                                lmsLaunchDataPayload.entitlementKey = lmsLaunchDataPayload.entitlementKey || {};
                                lmsLaunchDataPayload.entitlementKey.alternate = alternateEntitlementKey;
                            }

                            if (req.payload.returnUrl) {
                                lmsLaunchDataPayload.returnURL = req.payload.returnUrl;
                            }

                            lmsLaunchDataResponse = await lrsWreck.request(
                                "POST",
                                `activities/state?${lmsLaunchDataStateParams.toString()}`,
                                {
                                    headers: {
                                        "Content-Type": "application/json"
                                    },
                                    payload: lmsLaunchDataPayload
                                }
                            );

                            lmsLaunchDataResponseBody = await Wreck.read(lmsLaunchDataResponse, {json: true});
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed request to set LMS.LaunchData state document: ${ex}`));
                        }

                        if (lmsLaunchDataResponse.statusCode !== 204) {
                            throw Boom.internal(new Error(`Failed to store LMS.LaunchData state document (${lmsLaunchDataResponse.statusCode}): ${lmsLaunchDataResponseBody}`));
                        }

                        let launchedStResponse,
                            launchedStResponseBody;

                        try {
                            const launchedStContext = {
                                ...Hoek.clone(contextTemplate),
                                registration: reg.code,
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

                            if (launchParameters !== "") {
                                launchedStContext.extensions["https://w3id.org/xapi/cmi5/context/extensions/launchparameters"] = launchParameters;
                            }
                            if (masteryScore) {
                                launchedStContext.extensions["https://w3id.org/xapi/cmi5/context/extensions/masteryscore"] = masteryScore;
                            }

                            launchedStResponse = await lrsWreck.request(
                                "POST",
                                "statements",
                                {
                                    headers: {
                                        "Content-Type": "application/json"
                                    },
                                    payload: {
                                        id: uuidv4(),
                                        timestamp: new Date().toISOString(),
                                        actor,
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
                            tenantId,
                            registrationsCoursesAusId: regCourseAu.id,
                            code: sessionId,
                            isLaunched: true,
                            launchMode,
                            masteryScore,
                            launchTokenId: uuidv4(),

                            //
                            // capture the contextTemplate in the DB because it is possible to pass
                            // per session data to alter it, and it needs to be validated in aggregate
                            // when receiving the statements from the AU
                            //
                            contextTemplate: JSON.stringify(contextTemplate)
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
                                fetch: `${baseUrl}/fetch-url/${session.id}`,
                                actor: JSON.stringify(actor),
                                activityId: lmsActivityId,
                                registration: reg.code
                            }
                        );

                        return {
                            id: session.id,
                            launchMethod,
                            url: `${contentUrl}${contentUrl.indexOf("?") === -1 ? "?" : "&"}${launchUrlParams.toString()}`
                        };
                    }
                }
            ]
        );
    }
};
