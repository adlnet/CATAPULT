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

const fs = require("fs");
const util = require("util");
const Boom = require("@hapi/boom");
const Wreck = require("@hapi/wreck");
const Hoek = require("@hapi/hoek");
const Joi = require("joi");
const libxml = require("libxmljs");
const StreamZip = require("node-stream-zip");
const iri = require("iri");
const uuidv4 = require("uuid").v4;
const Helpers = require("../lib/helpers");
const Registration = require("../lib/registration");
const Session = require("../lib/session");
const helpers = require("../lib/helpers");
const readFile = util.promisify(fs.readFile);
const copyFile = util.promisify(fs.copyFile);
const mkdir = util.promisify(fs.mkdir);
const rm = util.promisify(fs.rm);

const rootPath = (process.env.PLAYER_API_ROOT || "");

const schemaText = fs.readFileSync(`${__dirname}/../../../xsd/v1/CourseStructure.xsd`);

const schema = libxml.parseXml(schemaText);
const schemaNS = "https://w3id.org/xapi/profiles/cmi5/v1/CourseStructure.xsd";

//
// this is basically a check for a scheme, assume that if there is a scheme
// that the URL is absolute, not checking for `://` because it could be a
// non-ip based URL per rfc1738
//
const isAbsolute = (url) => /^[A-Za-z]+:.+/.test(url);

const validateIRI = (input) => {
    try {
        new iri.IRI(input).toAbsolute();
    }
    catch (ex) {
        throw Helpers.buildViolatedReqId("3.0.0.0-1", `Invalid IRI: ${input}`, "badRequest");
    }

    return true;
};

const validateObjectiveRefs = (objectiveRefs, objectiveMap) => {
    const result = [];

    for (const objElement of objectiveRefs.childNodes()) {
        const idref = objElement.attr("idref").value();

        if (!objectiveMap[idref]) {
            throw new Error(`Invalid objective idref (${idref}): not found in objective map`);
        }

        result.push(idref);
    }

    return result;
};

const validateAU = (element, lmsIdHelper, objectiveMap, duplicateCheck, parents) => {
    const result = {
        type: "au",
        id: element.attr("id").value(),
        lmsId: `${lmsIdHelper.prefix}/au/${lmsIdHelper.auIndex++}`,
        objectives: null,
        parents: parents.map(
            (e) => ({ id: e.id, title: e.title })
        )
    },
        auTitle = element.get("xmlns:title", schemaNS),
        auDesc = element.get("xmlns:description", schemaNS),
        objectiveRefs = element.get("xmlns:objectives", schemaNS);

    validateIRI(result.id);

    if (duplicateCheck.aus[result.id]) {
        throw Helpers.buildViolatedReqId("13.1.4.0-1", `Invalid AU id (${result.id}: duplicate not allowed`, "badRequest");
    }

    duplicateCheck.aus[result.id] = true;

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
        result.objectives = validateObjectiveRefs(objectiveRefs, objectiveMap);
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
};

const validateBlock = (element, lmsIdHelper, objectiveMap, duplicateCheck, parents) => {
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

    parents.push(result);

    validateIRI(result.id);

    if (duplicateCheck.blocks[result.id]) {
        throw Helpers.buildViolatedReqId("13.1.2.0-1", `Invalid block id (${result.id}: duplicate not allowed`, "badRequest");
    }

    duplicateCheck.blocks[result.id] = true;

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
        result.objectives = validateObjectiveRefs(objectiveRefs, objectiveMap);
    }

    for (const child of element.childNodes()) {
        if (child.name() === "au") {
            result.children.push(
                validateAU(child, lmsIdHelper, objectiveMap, duplicateCheck, parents)
            );
        }
        else if (child.name() === "block") {
            result.children.push(
                validateBlock(child, lmsIdHelper, objectiveMap, duplicateCheck, parents)
            );
        }
    }

    parents.pop(result);

    return result;
};

const validateAndReduceStructure = (document, lmsId) => {
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
        },
        duplicateCheck = {
            aus: {},
            blocks: {}
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
                    throw Helpers.buildViolatedReqId("13.1.3.0-1", `Invalid objective id (${id}: duplicate not allowed`, "badRequest");
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

    const parents = [];

    for (const element of courseStructure.childNodes()) {
        if (element.name() === "au") {
            result.course.children.push(
                validateAU(element, lmsIdHelper, result.course.objectives, duplicateCheck, parents)
            );
        }
        else if (element.name() === "block") {
            result.course.children.push(
                validateBlock(element, lmsIdHelper, result.course.objectives, duplicateCheck, parents)
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
};

const flattenAUs = (tree, list) => {
    for (const child of tree) {
        if (child.type === "au") {
            child.auIndex = list.length;
            list.push(child);
        }
        else if (child.type === "block") {
            flattenAUs(child.children, list)
        }
    }
};

const getCourseDir = (tenantId, courseId) => `${__dirname}/../../../var/content/${tenantId}/${courseId}`;

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
                            contentType = req.headers["content-type"],

                            //
                            // application/x-zip-compressed seems to be deprecated but at least Windows 10
                            // still uses it for the MIME type value for a .zip file (depending on Registry
                            // settings) so this should support it
                            //
                            // the specification is only concerned about the format of the file and doesn't
                            // have requirements around MIME recognition or inclusion in import so it isn't
                            // a violation to make this handling more lax
                            //
                            isZip = contentType === "application/zip" || contentType === "application/x-zip-compressed";

                        let courseStructureDataRaw,
                            zip;

                        if (!isZip && contentType !== "text/xml") {
                            throw Helpers.buildViolatedReqId("14.0.0.0-1", `Unrecognized Content-Type: ${contentType}`, "badRequest");
                        }

                        if (isZip) {
                            try {
                                zip = new StreamZip.async({ file: req.payload.path });
                            }
                            catch (ex) {
                                throw Helpers.buildViolatedReqId("14.1.0.0-1", ex, "badRequest");
                            }

                            try {
                                courseStructureDataRaw = await zip.entryData("cmi5.xml");
                            }
                            catch (ex) {
                                if (ex.message === "Bad archive") {
                                    throw Helpers.buildViolatedReqId("14.1.0.0-1", ex, "badRequest");
                                }

                                throw Helpers.buildViolatedReqId("14.1.0.0-2", ex, "badRequest");
                            }
                        }
                        else {
                            try {
                                courseStructureDataRaw = await readFile(req.payload.path);
                            }
                            catch (ex) {
                                throw Boom.internal(`Failed to read structure file: ${ex}`);
                            }
                        }

                        let courseStructureData = await helpers.sanitizeXML(courseStructureDataRaw);
                        if (courseStructureData != undefined) {
                            let seemsOdd = await helpers.isPotentiallyMaliciousXML(courseStructureData);
                            if (seemsOdd) {
                                throw Boom.internal(`Invalid XML data provided: ${ex}`);
                            }
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
                            throw Helpers.buildViolatedReqId("13.2.0.0-1", `Failed to parse XML data: ${ex}`, "badRequest");
                        }

                        let validationResult;

                        try {
                            validationResult = courseStructureDocument.validate(schema);
                        }
                        catch (ex) {
                            throw Boom.internal(`Failed to validate course structure against schema: ${ex}`);
                        }

                        if (!validationResult) {
                            throw Helpers.buildViolatedReqId("13.2.0.0-1", `Invalid course structure data (schema violation): ${courseStructureDocument.validationErrors.join(",")}`, "badRequest");
                        }

                        let structure = validateAndReduceStructure(courseStructureDocument, lmsId, zip ? true : false);
                        const aus = [];

                        try {
                            flattenAUs(structure.course.children, aus);
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
                                // validating the URL using the newer URL support because it
                                // has a more strict implementation of URL parsing, but it
                                // requires a base URL to be provided to be able to handle
                                // relative URLs, but then we need to work with the URL in
                                // a way such that we maintain the relative nature so do that
                                // after validating
                                //
                                launchUrl = new URL(au.url, req.server.app.contentUrl);
                            }
                            catch (ex) {
                                throw Helpers.buildViolatedReqId("13.1.4.0-2", `'${au.url}': ${ex}`, "badRequest");
                            }

                            if (launchUrl.searchParams) {
                                for (const k of ["endpoint", "fetch", "actor", "activityId", "registration"]) {
                                    if (launchUrl.searchParams.get(k) !== null) {
                                        throw Helpers.buildViolatedReqId("8.1.0.0-6", k, "badRequest");
                                    }
                                }
                            }

                            if (!isAbsolute(au.url)) {
                                if (!zip) {
                                    throw Helpers.buildViolatedReqId("14.2.0.0-1", "relative URL not in a zip", "badRequest");
                                }

                                const zipEntry = await zip.entry(au.url.split('?')[0]);

                                if (!zipEntry) {
                                    // throw Helpers.buildViolatedReqId("14.1.0.0-4", `${launchUrl.pathname} not found in zip`, "badRequest");
                                    throw Helpers.buildViolatedReqId("14.1.0.0-4", `${au.url} not found in zip`, "badRequest");
                                }
                            }
                        }

                        let courseId;

                        try {
                            await db.transaction(
                                async (txn) => {
                                    const insertResult = await txn("courses").insert(
                                        {
                                            tenantId,
                                            lmsId,
                                            metadata: JSON.stringify({
                                                version: 1,
                                                aus
                                            }),
                                            structure: JSON.stringify({
                                                // this is "1.0.0" to match the spec version rather than being 1
                                                // like the metadata version above
                                                version: "1.0.0",
                                                ...structure
                                            })
                                        }
                                    );

                                    courseId = insertResult[0];

                                    await txn("courses_aus").insert(
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
                            await mkdir(courseDir, { recursive: true });
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed to create course content directory (${courseDir}): ${ex}`));
                        }

                        try {
                            if (isZip) {
                                await zip.extract(null, courseDir);
                            }
                            else {
                                await copyFile(req.payload.path, `${courseDir}/cmi5.xml`);
                            }
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed to store course content: ${ex}`));
                        }

                        return db.first("*").from("courses").queryContext({ jsonCols: ["metadata", "structure"] }).where({ tenantId: req.auth.credentials.tenantId, id: courseId });
                    }
                },

                {
                    method: "GET",
                    path: "/course/{id}",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        const result = await req.server.app.db.first("*").from("courses").queryContext({ jsonCols: ["metadata", "structure"] }).where({ tenantId: req.auth.credentials.tenantId, id: req.params.id });

                        if (!result) {
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
                            await req.server.app.db("courses").where({ tenantId, id: courseId }).delete();
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
                        tags: ["api"],
                        validate: {
                            payload: Joi.object({
                                actor: Joi.object({
                                    account: Joi.object({
                                        name: Joi.string().required(),
                                        homePage: Joi.string().required()
                                    }).required(),
                                    objectType: Joi.any().allow("Agent").optional(),
                                    name: Joi.string().optional()
                                }).required(),
                                reg: Joi.string().optional(),
                                contextTemplateAdditions: Joi.object().optional(),
                                launchMode: Joi.any().allow("Normal", "Browse", "Review").optional(),
                                launchParameters: Joi.string().optional(),
                                masteryScore: Joi.number().positive().min(0).max(1).optional(),
                                moveOn: Joi.any().allow("Passed", "Completed", "CompletedAndPassed", "CompletedOrPassed", "NotApplicable").optional(),
                                alternateEntitlementKey: Joi.string().optional(),
                                returnUrl: Joi.string().optional().description("LMS URL that learner should be sent to when the AU exits"),
                            }).required().label("Request-LaunchUrl")
                        }
                    },
                    handler: async (req, h) => {
                        const db = req.server.app.db,
                            courseId = req.params.id,
                            auIndex = req.params.auIndex,
                            actor = req.payload.actor,
                            code = req.payload.reg,
                            tenantId = req.auth.credentials.tenantId,
                            lrsWreck = Wreck.defaults(await req.server.methods.lrsWreckDefaults(req)),
                            course = await db.first("*").queryContext({ jsonCols: ["metadata", "structure"] }).from("courses").where(
                                {
                                    tenantId,
                                    id: courseId
                                }
                            );

                        if (!course) {
                            throw Boom.notFound(`Unrecognized course: ${courseId} (${tenantId})`);
                        }

                        let registrationId;

                        if (code) {
                            // check for registration record and validate details match
                            const selectResult = await db.first("id", "actor").queryContext({ jsonCols: ["actor"] }).from("registrations").where(
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

                        if (!registrationId) {
                            // either this is a new registration or we didn't find one they were expecting
                            // so go ahead and create the registration now
                            registrationId = await Registration.create(
                                {
                                    tenantId,
                                    courseId,
                                    actor,
                                    code
                                },
                                {
                                    db,
                                    lrsWreck
                                }
                            );
                        }

                        const reg = await Registration.load({ tenantId, registrationId }, { db }),
                            { registrationsCoursesAus: regCourseAu, coursesAus: courseAu } = await db
                                .first("*")
                                .queryContext({ jsonCols: ["registrations_courses_aus.metadata", "courses_aus.metadata"] })
                                .from("registrations_courses_aus")
                                .leftJoin("courses_aus", "registrations_courses_aus.course_au_id", "courses_aus.id")
                                .where(
                                    {
                                        "registrations_courses_aus.tenant_id": tenantId,
                                        "registrations_courses_aus.registration_id": registrationId,
                                        "courses_aus.au_index": auIndex
                                    }
                                )
                                .options({ nestTables: true });

                        //
                        // check for existing open sessions and abandon them,
                        // in theory this should only ever return at most one
                        // but if it were to return more than one then might
                        // as well abandon them all
                        //
                        const openSessions = await db
                            .select("sessions.id")
                            .from("sessions")
                            .leftJoin("registrations_courses_aus", "sessions.registrations_courses_aus_id", "registrations_courses_aus.id")
                            .where(
                                {
                                    "sessions.tenant_id": tenantId,
                                    "registrations_courses_aus.registration_id": registrationId,
                                    "sessions.is_terminated": false,
                                    "sessions.is_abandoned": false
                                }
                            );

                        if (openSessions) {
                            for (const session of openSessions) {
                                await Session.abandon(session.id, tenantId, "new-launch", { db, lrsWreck });
                            }
                        }
                        
                        //Debug messages for troubleshooting host and path issuse - MB
                        console.log("req.url.protocol is ", req.url.protocol);
                        console.log("req.url.host is ", req.url.host);
                        console.log("rootPath is ", rootPath);
                        
                        let forwardingHeader = req.headers["x-forwarded-proto"];
                        let protocol = (forwardingHeader === "https") ? "https:" : req.url.protocol;

                        const lmsActivityId = courseAu.lms_id,
                            publisherActivityId = course.metadata.aus[auIndex].id,
                            launchMethod = courseAu.metadata.launchMethod || "AnyWindow",
                            launchMode = req.payload.launchMode || (regCourseAu.is_satisfied ? "Review" : "Normal"),
                            launchParameters = req.payload.launchParameters || courseAu.metadata.launchParameters,
                            masteryScore = req.payload.masteryScore || courseAu.metadata.masteryScore,
                            moveOn = req.payload.moveOn || courseAu.metadata.moveOn || "NotApplicable",
                            alternateEntitlementKey = req.payload.alternateEntitlementKey || courseAu.metadata.alternateEntitlementKey,
                    
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
                        
                        let launchURLBase = (process.env.PLAYER_STANDALONE_LAUNCH_URL_BASE || `${protocol}//${req.url.host}${rootPath}`);
                        let endpoint = `${launchURLBase}/lrs`;
                        
                        // //Debug messages for troubleshooting host and path issuse - MB
                        // console.log("Base url is ", baseUrl);
                        // console.log("Which makes endpoint ", endpoint);
                        // console.log("Forwarded Header: ", req.headers["x-forwarded-proto"]);

                        if (req.payload.contextTemplateAdditions) {
                            Hoek.merge(contextTemplate, req.payload.contextTemplateAdditions, { nullOverride: false });
                        }

                        let contentUrl;

                        if (isAbsolute(course.metadata.aus[auIndex].url)) {
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

                            //  //Debug messages for troubleshooting host and path issuse - MB
                            //     console.log("lmsLaunchDataStateParams.toString() is ", lmsLaunchDataStateParams.toString());
                            //     console.log("lmsLaunchDataStateParams is ", lmsLaunchDataStateParams);
                            //     console.log("lmsLaunchDataPayload is ", lmsLaunchDataPayload);

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
                            // //Debug messages for troubleshooting host and path issuse - MB
                            //     console.log("lmsLaunchDataPayload is ", lmsLaunchDataPayload);
                            //     console.log("activities/state?${lmsLaunchDataStateParams.toString()} is ", `activities/state?${lmsLaunchDataStateParams.toString()}`);
                            //     console.log("lmsLaunchDataResponse is ", lmsLaunchDataResponse);
                                
                            lmsLaunchDataResponseBody = await Wreck.read(lmsLaunchDataResponse, { json: true });
                            
                        }
                        catch (ex) {
                            console.error(ex);
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

                            launchedStResponseBody = await Wreck.read(launchedStResponse, { json: true });
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed request to store launched statement: ${ex}`));
                        }

                        if (launchedStResponse.statusCode !== 200) {
                            throw Boom.internal(new Error(`Failed to store launched statement: ${launchedStResponse.statusCode}`));
                        }

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
                            const sessionInsertResult = await db.insert(session).into("sessions");

                            session.id = sessionInsertResult[0];
                        }
                        catch (ex) {
                            console.error(ex);
                            throw Boom.internal(new Error(`Failed to insert session: ${ex}`));
                        }

                        const launchUrlParams = new URLSearchParams(
                            {
                                endpoint,
                                fetch: `${launchURLBase}/fetch-url/${session.id}`,
                                actor: JSON.stringify(actor),
                                activityId: lmsActivityId,
                                registration: reg.code
                            }
                        );
                            let urlCheck;
                            urlCheck= `${contentUrl}${contentUrl.indexOf("?") === -1 ? "?" : "&"}${launchUrlParams.toString()}`
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
