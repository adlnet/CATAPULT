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

const Boom = require("@hapi/boom"),
    Wreck = require("@hapi/wreck"),
    Hoek = require("@hapi/hoek"),
    Registration = require("./v1/lib/registration"),
    CMI5_DEFINED_ID = "https://w3id.org/xapi/cmi5/context/categories/cmi5",
    CMI5_EXTENSION_SESSION_ID = "https://w3id.org/xapi/cmi5/context/extensions/sessionid",

    VERB_INITIALIZED_ID = "http://adlnet.gov/expapi/verbs/initialized",
    VERB_TERMINATED_ID = "http://adlnet.gov/expapi/verbs/terminated",
    VERB_COMPLETED_ID = "http://adlnet.gov/expapi/verbs/completed",
    VERB_PASSED_ID = "http://adlnet.gov/expapi/verbs/passed",
    VERB_FAILED_ID = "http://adlnet.gov/expapi/verbs/failed",

    beforeLRSRequest = (req, session) => {
        const result = {
            launchData: null,
            learnerPrefs: null,
            statements: []
        };
        let method = req.method;

        if (method === "post" && typeof req.query.method !== "undefined") {
            method = req.query.method;

            throw new Error(`Alternate method request syntax not implemented: ${method} to ${req.query.method}`);
        }

        const resource = req.params.resource;

        if (resource === "statements") {
            if (method === "post" || method === "put") {
                const statements = Array.isArray(req.payload) ? req.payload : [req.payload];

                for (const st of statements) {
                    for (const prop of ["actor", "verb", "object"]) {
                        if (typeof st[prop] === "undefined") {
                            throw Boom.badRequest(new Error(`4.1.0.0-1 - An Assignable Unit MUST conform to all requirements as specified in the xAPI specification. (Invalid statement missing: ${prop})`));
                        }
                    }
                    if (typeof st.verb.id === "undefined") {
                        throw Boom.badRequest(new Error("4.1.0.0-1 - An Assignable Unit MUST conform to all requirements as specified in the xAPI specification. (Invalid statement missing: verb.id)"));
                    }

                    // all statements have to have the actor, the context based on the template,
                    // timestamp, id, etc.
                    if (typeof st.id === "undefined") {
                        throw Boom.unauthorized(new Error("9.1.0.0-1 - The AU MUST assign a statement id property in UUID format (as defined in the xAPI specification) for all statements it issues. (Statement id missing)"));
                    }

                    const timestampDate = new Date(st.timestamp);

                    if (timestampDate.getTimezoneOffset() !== 0) {
                        throw Boom.unauthorized(new Error(`9.7.0.0-2 - All timestamps MUST be recorded in UTC time. (${st.id})`));
                    }

                    if (! st.context || ! st.context.contextActivities) {
                        throw Boom.unauthorized(new Error(`10.2.1.0-6 - The AU MUST use the contextTemplate as a template for the "context" property in all xAPI statements it sends to the LMS. (${st.id})`));
                    }
                    if (! st.context.registration) {
                        throw Boom.unauthorized(new Error(`9.6.1.0-1 - The value for the registration property used in the context object MUST be the value provided by the LMS. (registration missing in ${st.id})`));
                    }

                    if (! st.context.extensions || ! st.context.extensions[CMI5_EXTENSION_SESSION_ID]) {
                        throw Boom.unauthorized(new Error(`9.6.3.1-4 - An AU MUST include the session ID provided by the LMS in the context as an extension for all "cmi5 defined" and "cmi5 allowed" statements it makes directly in the LRS. (${st.id})`));
                    }

                    if (! session.is_initialized && st.verb.id !== VERB_INITIALIZED_ID) {
                        throw Boom.unauthorized(new Error(`9.3.0.0-4 - The "Initialized" verb MUST be the first statement (cmi5 allowed or defined). (${st.id})`));
                    }

                    if (session.is_terminated) {
                        throw Boom.unauthorized(new Error(`9.3.0.0-5 - The "Terminated" verb MUST be the last statement (cmi5 allowed or defined). (${st.id})`));
                    }

                    if (st.context.contextActivities
                        && st.context.contextActivities.category
                        && Array.isArray(st.context.contextActivities.category)
                        && st.context.contextActivities.category.some((element) => element.id === CMI5_DEFINED_ID)
                    ) {
                        //
                        // undefined actor.objectType implies Agent
                        //
                        if (typeof st.actor.objectType !== "undefined" && st.actor.objectType !== "Agent") {
                            throw Boom.unauthorized(new Error(`9.2.0.0-2 - The Actor property for all "cmi5 defined" statements MUST be of objectType "Agent". (${st.id})`));
                        }

                        if (typeof st.actor.account === "undefined" || typeof st.actor.account.name === "undefined" || typeof st.actor.account.homePage === "undefined") {
                            throw Boom.unauthorized(new Error(`9.2.0.0-3 - The Actor property MUST contain an "account" IFI as defined in the xAPI specification. (${st.id})`));
                        }

                        const verbId = st.verb.id;

                        if (! st.result) {
                            if (verbId === VERB_COMPLETED_ID) {
                                throw Boom.unauthorized(new Error(`9.5.3.0-1 - The "completion" property of the result MUST be set to true for the following cmi5 defined statements ["Completed", "Waived"]. (${st.id})`));
                            }
                            else if (verbId === VERB_PASSED_ID) {
                                throw Boom.unauthorized(new Error(`9.5.2.0-1 - The "success" property of the result MUST be set to true for the following cmi5 defined statements ["Passed", "Waived"]. (${st.id})`));
                            }
                            else if (verbId === VERB_FAILED_ID) {
                                throw Boom.unauthorized(new Error(`9.5.2.0-2 - The "success" property of the result MUST be set to false for the following cmi5 defined statements ["Failed"]. (${st.id})`));
                            }
                        }
                        else {
                            if (typeof st.result.completion !== "undefined") {
                                // Note: this has to be an AU request and AUs can't send waived
                                if (verbId !== VERB_COMPLETED_ID) {
                                    throw Boom.unauthorized(new Error(`9.5.3.0-2 - cmi5 defined statements, other than "Completed" or "Waived", MUST NOT include the "completion" property. (${st.id})`));
                                }
                                else if (verbId === VERB_COMPLETED_ID && st.result.completion !== true) {
                                    throw Boom.unauthorized(new Error(`9.5.3.0-1 - The "completion" property of the result MUST be set to true for the following cmi5 defined statements ["Completed", "Waived"]. (${st.id})`));
                                }
                            }

                            if (typeof st.result.success !== "undefined") {
                                // Note: this has to be an AU request and AUs can't send waived
                                if (verbId !== VERB_PASSED_ID && verbId !== VERB_FAILED_ID) {
                                    throw Boom.unauthorized(new Error(`9.5.2.0-3 - cmi5 defined statements, other than "Passed", "Waived" or "Failed", MUST NOT include the "success" property. (${st.id})`));
                                }
                                else if (verbId === VERB_PASSED_ID && st.result.success !== true) {
                                    throw Boom.unauthorized(new Error(`9.5.2.0-1 - The "success" property of the result MUST be set to true for the following cmi5 defined statements ["Passed", "Waived"]. (${st.id})`));
                                }
                                else if (verbId === VERB_FAILED_ID && st.result.success !== false) {
                                    throw Boom.unauthorized(new Error(`9.5.2.0-2 - The "success" property of the result MUST be set to false for the following cmi5 defined statements ["Failed"]. (${st.id})`));
                                }
                            }

                            if (st.score) {
                                if (verbId !== VERB_PASSED_ID || verbId !== VERB_FAILED_ID) {
                                    throw Boom.unauthorized(new Error(`9.5.1.0-2 - cmi5 defined statements, other than "Passed" or "Failed", MUST NOT include the "score" property. (${st.id})`));
                                }

                                if (st.score.raw && (! st.score.min || ! st.score.max)) {
                                    throw Boom.unauthorized(new Error(`9.5.1.0-3 - The AU MUST provide the "min" and "max" values for "score" when the "raw" value is provided. (${st.id})`));
                                }
                            }
                        }

                        switch (verbId) {
                            case VERB_INITIALIZED_ID:
                                if (session.is_initialized || result.statements.includes(VERB_INITIALIZED_ID)) {
                                    throw Boom.unauthorized(new Error(`9.3.0.0-2 - Verbs MUST NOT be duplicated (in cmi5 defined statements). (${st.id})`));
                                }
                                break;

                            case VERB_TERMINATED_ID:
                                if (result.statements.includes(VERB_TERMINATED_ID)) {
                                    throw Boom.unauthorized(new Error(`9.3.0.0-2 - Verbs MUST NOT be duplicated (in cmi5 defined statements). (${st.id})`));
                                }
                                break;

                            case VERB_COMPLETED_ID:
                                if (session.is_completed || result.statements.includes(VERB_COMPLETED_ID)) {
                                    throw Boom.unauthorized(new Error(`9.3.0.0-2 - Verbs MUST NOT be duplicated (in cmi5 defined statements). (${st.id})`));
                                }
                                break;

                            case VERB_PASSED_ID:
                                if (session.is_passed || result.statements.includes(VERB_PASSED_ID)) {
                                    throw Boom.unauthorized(new Error(`9.3.0.0-2 - Verbs MUST NOT be duplicated (in cmi5 defined statements). (${st.id})`));
                                }
                                break;

                            case VERB_FAILED_ID:
                                if (session.is_failed || result.statements.includes(VERB_FAILED_ID)) {
                                    throw Boom.unauthorized(new Error(`9.3.0.0-2 - Verbs MUST NOT be duplicated (in cmi5 defined statements). (${st.id})`));
                                }
                                break;

                            default:
                                throw Boom.unauthorized(new Error(`9.3.0.0-1 - AUs MUST use the below verbs that are indicated as mandatory in other sections of this specification. (Unrecognized cmi5 defined statement: ${verbId} - ${st.id})`));
                        }

                        // do this after the checks so that we can check the list for a particular verb
                        result.statements.push(verbId);
                    }
                    else {
                        console.log("cmi5 allowed statement", st.verb.id);
                    }
                }
            }
        }
        else if (resource === "activities/state" && req.query.stateId === "LMS.LaunchData") {
            if (method === "get") {
                result.launchData = true;
            }
            else {
                throw Boom.unauthorized(new Error(`10.2.1.0-5 - The AU MUST NOT modify or delete the "LMS.LaunchData" State document. (${method}`));
            }
        }
        else if (resource === "agents/profile" && req.query.profileId === "cmi5LearnerPreferences") {
            if (method === "get") {
                result.learnerPrefs = true;
            }
            else if (method === "delete") {
                throw Boom.unauthorized(new Error("Rejected request to delete the learner preferences Agent Profile document"));
            }
            else if (method === "put" || method === "post") {
                throw Boom.unauthorized(new Error("Rejected request to alter the learner preferences Agent Profile document"));
            }
        }

        return result;
    },
    afterLRSRequest = async (req, res, txn, beforeResult, session, regCourseAu, registration) => {
        const status = res.statusCode,
            sessionUpdates = {
                lastRequestTime: txn.fn.now()
            };
        let registrationCourseAuUpdates;

        if (beforeResult.statements.length > 0) {
            if ((status === 200 || status === 204)) {
                let nowSatisfied = false;

                for (const verbId of beforeResult.statements) {
                    switch (verbId) {
                        case VERB_INITIALIZED_ID:
                            sessionUpdates.is_initialized = true;
                            break;

                        case VERB_TERMINATED_ID:
                            sessionUpdates.is_terminated = true;
                            break;

                        case VERB_COMPLETED_ID:
                            sessionUpdates.is_completed = true;

                            registrationCourseAuUpdates = registrationCourseAuUpdates || {};
                            registrationCourseAuUpdates.is_completed = true;

                            regCourseAu.is_completed = 1;

                            if (! regCourseAu.isSatisfied
                                && (regCourseAu.metadata.moveOn === "Completed"
                                    || regCourseAu.metadata.moveOn === "CompletedOrPassed"
                                    || (regCourseAu.metadata.moveOn === "CompletedAndPassed" && regCourseAu.is_passed)
                                )
                            ) {
                                nowSatisfied = true;
                            }

                            break;

                        case VERB_PASSED_ID:
                            sessionUpdates.is_passed = true;

                            registrationCourseAuUpdates = registrationCourseAuUpdates || {};
                            registrationCourseAuUpdates.is_passed = true;

                            regCourseAu.is_passed = 1;

                            if (! regCourseAu.isSatisfied
                                && (regCourseAu.metadata.moveOn === "Passed"
                                    || regCourseAu.metadata.moveOn === "CompletedOrPassed"
                                    || (regCourseAu.metadata.moveOn === "CompletedAndPassed" && regCourseAu.is_completed)
                                )
                            ) {
                                nowSatisfied = true;
                            }

                            break;

                        case VERB_FAILED_ID:
                            sessionUpdates.is_failed = true;
                            break;
                    }
                }

                if (registrationCourseAuUpdates) {
                    if (nowSatisfied) {
                        registrationCourseAuUpdates.isSatisfied = true;
                    }

                    try {
                        await txn("registrations_courses_aus").update(registrationCourseAuUpdates).where({id: session.registrations_courses_aus_id});
                    }
                    catch (ex) {
                        throw new Error(`Failed to update registrations_courses_aus: ${ex}`);
                    }
                }

                if (nowSatisfied) {
                    registrationCourseAuUpdates.is_satisfied = true;

                    try {
                        await Registration.interpretMoveOn(
                            registration,
                            {
                                auToSetSatisfied: regCourseAu.courseAu.lms_id,
                                session,
                                lrsWreck: Wreck.defaults(
                                    {
                                        baseUrl: req.server.app.lrs.endpoint,
                                        headers: {
                                            "X-Experience-API-Version": "1.0.3",
                                            Authorization: `Basic ${Buffer.from(`${req.server.app.lrs.username}:${req.server.app.lrs.password}`).toString("base64")}`
                                        },
                                        json: true
                                    }
                                )
                            }
                        );
                    }
                    catch (ex) {
                        throw new Error(`Failed to interpret moveOn: ${ex}`);
                    }

                    try {
                        await txn("registrations").update({metadata: JSON.stringify(registration.metadata)}).where({id: registration.id});
                    }
                    catch (ex) {
                        throw new Error(`Failed to update registration metadata: ${ex}`);
                    }
                }
            }
        }
        else if (beforeResult.launchData && status === 200) {
            sessionUpdates.launch_data_fetched = true;
        }
        else if (beforeResult.learnerPrefs && (status === 200 || status === 404)) {
            sessionUpdates.learner_prefs_fetched = true;
        }

        try {
            await txn("sessions").update(sessionUpdates).where({id: session.id});
        }
        catch (ex) {
            throw new Error(`Failed to update session: ${ex}`);
        }
    };

//
// all requests here are neceesarily made by the AU because any LMS
// based requests are being made by this player
//
module.exports = {
    name: "catapult-player-api-routes-lrs",
    register: (server, options) => {
        server.auth.strategy(
            "proxied-lrs",
            "basic",
            {
                allowEmptyUsername: true,
                validate: async (req, key, secret) => {
                    const session = await req.server.app.db.first("*").from("sessions").where({launch_token_id: secret});
                    if (! session) {
                        return {isValid: false, credentials: null};
                    }

                    return {
                        isValid: true,
                        credentials: {
                            id: session.id,
                            tenantId: session.tenantId
                        }
                    };
                }
            }
        );

        // OPTIONS requests don't provide an authorization header, so set this up
        // as a separate route without auth
        server.route(
            {
                method: [
                    "OPTIONS"
                ],
                path: "/lrs/{resource*}",
                options: {
                    auth: false,

                    //
                    // turn off CORS for this handler because the LRS will provide back the right headers
                    // this just needs to pass them through, enabling CORS for this route means they get
                    // overwritten by the Hapi handling
                    //
                    cors: false
                },
                handler: {
                    proxy: {
                        passThrough: true,
                        xforward: true,

                        //
                        // map the requested resource (i.e. "statements" or "activities/state") from the
                        // provided LRS endpoint to the resource at the underlying LRS endpoint, while
                        // maintaining any query string parameters
                        //
                        mapUri: (req) => ({
                            uri: `${req.server.app.lrs.endpoint}/${req.params.resource}${req.url.search}`
                        })
                    }
                }
            }
        );

        server.route(
            {
                method: [
                    "GET",
                    "POST",
                    "PUT",
                    "DELETE"
                ],
                path: "/lrs/{resource*}",
                options: {
                    auth: "proxied-lrs",
                    cors: true
                },
                //
                // not using h2o2 to proxy these resources because there needs to be validation
                // of the incoming payload which means it needs to be loaded into memory and parsed,
                // etc. which h2o2 won't do with proxied requests because of the performance overhead
                // so this code is nearly the same as what the handler for h2o2 does, but with fewer
                // settings that weren't being used anyways
                //
                handler: async (req, h) => {
                    const db = req.server.app.db,
                        txn = await db.transaction();
                    let session,
                        regCourseAu,
                        registration,
                        courseAu,
                        result;

                    try {
                        // the extra set of parens are necessary here for non-declaration assignment destructuring,
                        // and the use of nestTables seems to switch off the automatic string casing
                        ({
                            sessions: session,
                            registrationsCoursesAus: regCourseAu,
                            registrations: registration,
                            coursesAus: courseAu
                        } = await txn
                            .first("*")
                            .from("sessions")
                            .leftJoin("registrations_courses_aus", "sessions.registrations_courses_aus_id", "registrations_courses_aus.id")
                            .leftJoin("registrations", "registrations_courses_aus.registration_id", "registrations.id")
                            .leftJoin("courses_aus", "registrations_courses_aus.course_au_id", "courses_aus.id")
                            .where(
                                {
                                    "sessions.id": req.auth.credentials.id,
                                    "sessions.tenant_id": req.auth.credentials.tenantId
                                }
                            )
                            .queryContext({jsonCols: ["registrations_courses_aus.metadata", "registrations.actor", "registrations.metadata", "courses_aus.metadata"]})
                            .forUpdate()
                            .options({nestTables: true})
                        );

                        regCourseAu.courseAu = courseAu;
                    }
                    catch (ex) {
                        txn.rollback();
                        throw new Error(`Failed to select session, registration course AU, registration and course AU for update: ${ex}`);
                    }

                    let response;

                    try {
                        const beforeResult = beforeLRSRequest(req, session);

                        const uri = `${req.server.app.lrs.endpoint}/${req.params.resource}${req.url.search}`,
                            protocol = uri.split(":", 1)[0],
                            options = {
                                headers: Hoek.clone(req.headers),
                                payload: req.payload
                            };

                        delete options.headers.host;
                        delete options.headers["content-length"];

                        //
                        // switch the authorization credential from the player session based value
                        // to the general credential we have for the underlying LRS
                        //
                        if (typeof req.headers.authorization !== "undefined") {
                            options.headers.authorization = `Basic ${Buffer.from(`${req.server.app.lrs.username}:${req.server.app.lrs.password}`).toString("base64")}`;
                        }

                        if (req.info.remotePort) {
                            options.headers["x-forwarded-for"] = (options.headers["x-forwarded-for"] ? options.headers["x-forwarded-for"] + "," : "") + req.info.remoteAddress;
                            options.headers["x-forwarded-port"] = options.headers["x-forwarded-port"] || req.info.remotePort;
                            options.headers["x-forwarded-proto"] = options.headers["x-forwarded-proto"] || req.server.info.protocol;
                            options.headers["x-forwarded-host"] = options.headers["x-forwarded-host"] || req.info.host;
                        }

                        const res = await Wreck.request(req.method, uri, options),
                            payload = await Wreck.read(res);

                        response = h.response(payload).passThrough(true);

                        response.code(res.statusCode);
                        response.message(res.statusMessage);

                        for (const [k, v] of Object.entries(res.headers)) {
                            if (k.toLowerCase() !== "transfer-encoding") {
                                response.header(k, v);
                            }
                        }

                        // clean up the original response
                        res.destroy();

                        await afterLRSRequest(req, res, txn, beforeResult, session, regCourseAu, registration);

                        txn.commit();
                    }
                    catch (ex) {
                        txn.rollback();
                        throw ex;
                    }

                    return response;
                }
            }
        );
    }
};
