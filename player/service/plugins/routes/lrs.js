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
    Iso8601Duration = require("iso8601-duration"),
    Requirements = require("@cmi5/requirements"),
    Helpers = require("./lib/helpers"),
    Registration = require("./lib/registration"),
    Session = require("./lib/session"),
    CMI5_DEFINED_ID = "https://w3id.org/xapi/cmi5/context/categories/cmi5",
    CMI5_EXTENSION_SESSION_ID = "https://w3id.org/xapi/cmi5/context/extensions/sessionid",
    CMI5_EXTENSION_MASTERY_SCORE = "https://w3id.org/xapi/cmi5/context/extensions/masteryscore",
    CMI5_CATEGORY_ACTIVITY_MOVEON_ID = "https://w3id.org/xapi/cmi5/context/categories/moveon",

    VERB_INITIALIZED_ID = "http://adlnet.gov/expapi/verbs/initialized",
    VERB_TERMINATED_ID = "http://adlnet.gov/expapi/verbs/terminated",
    VERB_COMPLETED_ID = "http://adlnet.gov/expapi/verbs/completed",
    VERB_PASSED_ID = "http://adlnet.gov/expapi/verbs/passed",
    VERB_FAILED_ID = "http://adlnet.gov/expapi/verbs/failed",

    matchActor = (provided, expected, msg = "") => {
        if (! Hoek.deepEqual(provided, expected)) {
            throw Helpers.buildViolatedReqId("8.1.3.0-3", msg);
        }
    },

    matchRegistration = (provided, expected, msg = "") => {
        if (provided !== expected) {
            throw Helpers.buildViolatedReqId("8.1.4.0-3", msg);
        }
    },

    matchContextTemplate = (provided, expected, msg = "") => {
        for (const prop of Object.keys(expected)) {
            if (prop === "contextActivities") {
                for (const k of Object.keys(expected[prop])) {
                    for (let i = 0; i < expected[prop][k].length; i += 1) {
                        if (typeof provided[prop][k][i] === "undefined" || provided[prop][k][i].id !== expected[prop][k][i].id) {
                            // also covers 9.6.2.0-1
                            throw Helpers.buildViolatedReqId("10.2.1.0-6", `context does not match template: '${prop}' '${k}' '${i}' value differs`);
                        }
                    }
                }
            }
            else {
                if (typeof provided[prop] === "undefined") {
                    throw Helpers.buildViolatedReqId("10.2.1.0-6", `context does not match template: '${prop}' missing`);
                }

                for (const [k, v] of Object.entries(expected[prop])) {
                    if (typeof provided[prop][k] === "undefined" || ! Hoek.deepEqual(provided[prop][k], expected[prop][k])) {
                        throw Helpers.buildViolatedReqId("10.2.1.0-6", `context does not match template: '${prop}' '${k}' value differs`);
                    }
                }
            }
        }
    },

    beforeLRSRequest = (req, session, regCourseAu, registration) => {
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
                if (! session.learner_prefs_fetched) {
                    throw Helpers.buildViolatedReqId("11.0.0.0-3", "(Learner Prefs not yet retrieved)");
                }

                const statements = Array.isArray(req.payload) ? req.payload : [req.payload];

                for (const st of statements) {
                    for (const prop of ["actor", "verb", "object"]) {
                        if (typeof st[prop] === "undefined") {
                            throw Helpers.buildViolatedReqId("4.1.0.0-1", `Invalid statement missing: ${prop}`, "badRequest");
                        }
                    }
                    if (typeof st.verb.id === "undefined") {
                        throw Helpers.buildViolatedReqId("4.1.0.0-1", `Invalid statement missing: verb.id`, "badRequest");
                    }

                    // all statements have to have the actor, the context based on the template,
                    // timestamp, id, etc.
                    if (typeof st.id === "undefined") {
                        throw Helpers.buildViolatedReqId("9.1.0.0-1", `Statement id missing`);
                    }

                    if (st.verb.id === "http://adlnet.gov/expapi/verbs/voided") {
                        throw Helpers.buildViolatedReqId("6.3.0.0-1", st.id);
                    }

                    if (typeof st.timestamp === "undefined") {
                        throw Helpers.buildViolatedReqId("9.7.0.0-1", st.id);
                    }

                    // UTC is "Z", "+00:00", "+0000", or "+00"
                    if (! /(Z|\+00:?(?:00)?)$/.test(st.timestamp)) {
                        throw Helpers.buildViolatedReqId("9.7.0.0-2", st.id);
                    }

                    matchActor(st.actor, registration.actor, st.id);

                    if (! st.context) {
                        throw Helpers.buildViolatedReqId("9.6.0.0-1", `no context: ${st.id}`);
                    }
                    if (! st.context.contextActivities) {
                        throw Helpers.buildViolatedReqId("10.2.1.0-6", `no contextActivities: ${st.id}`);
                    }

                    matchContextTemplate(st.context, session.context_template);

                    if (
                        st.context.contextActivities.category
                        &&
                        st.context.contextActivities.category.some((element) => element.id === CMI5_CATEGORY_ACTIVITY_MOVEON_ID)
                        &&
                        (
                            (! st.context.contextActivities.category.some((element) => element.id === CMI5_DEFINED_ID)
                                || (st.verb.id !== VERB_PASSED_ID && st.verb.id !== VERB_FAILED_ID && st.verb.id !== VERB_COMPLETED_ID)
                            )
                        )
                    ) {
                        throw Helpers.buildViolatedReqId("9.6.2.2-2", st.id);
                    }
                    if (! st.context.registration) {
                        throw Helpers.buildViolatedReqId("9.6.1.0-1", `registration missing in ${st.id}`);
                    }
                    if (st.context.registration !== registration.code) {
                        throw Helpers.buildViolatedReqId("9.6.1.0-1", `registration does not match in ${st.id}`);
                    }

                    if (! st.context.extensions || ! st.context.extensions[CMI5_EXTENSION_SESSION_ID]) {
                        throw Helpers.buildViolatedReqId("9.6.3.1-4", st.id);
                    }

                    if (! session.is_initialized && st.verb.id !== VERB_INITIALIZED_ID) {
                        throw Helpers.buildViolatedReqId("9.3.0.0-4", st.id);
                    }

                    if (session.is_terminated) {
                        throw Helpers.buildViolatedReqId("9.3.0.0-5", st.id);
                    }
                    if (session.is_abandoned) {
                        // see comment below in proxied-lrs auth
                        throw Boom.forbidden(`9.3.6.0-2 - ${Requirements["9.3.6.0-2"].txt} (${st.id})`);
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
                            throw Helpers.buildViolatedReqId("9.2.0.0-2", st.id);
                        }

                        if (typeof st.actor.account === "undefined" || typeof st.actor.account.name === "undefined" || typeof st.actor.account.homePage === "undefined") {
                            throw Helpers.buildViolatedReqId("9.2.0.0-3", st.id);
                        }

                        if (typeof st.object.id === "undefined") {
                            throw Helpers.buildViolatedReqId("9.4.0.0-1", st.id);
                        }
                        else if (st.object.id !== regCourseAu.courseAu.lms_id) {
                            // also validates for 9.4.0.0-2
                            throw Helpers.buildViolatedReqId("8.1.5.0-6", st.id);
                        }

                        const verbId = st.verb.id;

                        if (session.launch_mode === "Browse" && (verbId === VERB_COMPLETED_ID || verbId === VERB_PASSED_ID || verbId === VERB_FAILED_ID)) {
                            throw Helpers.buildViolatedReqId("10.2.2.0-2", st.id);
                        }
                        else if (session.launch_mode === "Review" && (verbId === VERB_COMPLETED_ID || verbId === VERB_PASSED_ID || verbId === VERB_FAILED_ID)) {
                            throw Helpers.buildViolatedReqId("10.2.2.0-3", st.id);
                        }

                        if (! st.result) {
                            if (verbId === VERB_COMPLETED_ID) {
                                throw Helpers.buildViolatedReqId("9.5.3.0-1", st.id);
                            }
                            else if (verbId === VERB_PASSED_ID) {
                                throw Helpers.buildViolatedReqId("9.5.2.0-1", st.id);
                            }
                            else if (verbId === VERB_FAILED_ID) {
                                throw Helpers.buildViolatedReqId("9.5.2.0-2", st.id);
                            }
                            else if (verbId === VERB_TERMINATED_ID) {
                                throw Helpers.buildViolatedReqId("9.5.4.1-1", st.id);
                            }
                        }
                        else {
                            // Note: this has to be an AU request and AUs can't send waived
                            if (typeof st.result.completion !== "undefined" && verbId !== VERB_COMPLETED_ID) {
                                throw Helpers.buildViolatedReqId("9.5.3.0-2", st.id);
                            }
                            else if (verbId === VERB_COMPLETED_ID && st.result.completion !== true) {
                                throw Helpers.buildViolatedReqId("9.5.3.0-1", st.id);
                            }

                            // Note: this has to be an AU request and AUs can't send waived
                            if (typeof st.result.success !== "undefined" && verbId !== VERB_PASSED_ID && verbId !== VERB_FAILED_ID) {
                                throw Helpers.buildViolatedReqId("9.5.2.0-3", st.id);
                            }
                            else if (verbId === VERB_PASSED_ID && st.result.success !== true) {
                                throw Helpers.buildViolatedReqId("9.5.2.0-1", st.id);
                            }
                            else if (verbId === VERB_FAILED_ID && st.result.success !== false) {
                                throw Helpers.buildViolatedReqId("9.5.2.0-2", st.id);
                            }

                            if (
                                (typeof st.result.completion !== "undefined" || typeof st.result.success !== "undefined")
                                && ! st.context.contextActivities.category.some((element) => element.id === CMI5_CATEGORY_ACTIVITY_MOVEON_ID)
                            ) {
                                throw Helpers.buildViolatedReqId("9.6.2.2-1", st.id);
                            }

                            if (st.result.score) {
                                if (verbId !== VERB_PASSED_ID && verbId !== VERB_FAILED_ID) {
                                    throw Helpers.buildViolatedReqId("9.5.1.0-2", st.id);
                                }

                                if (st.result.score.raw && (typeof st.result.score.min === "undefined" || typeof st.result.score.max === "undefined")) {
                                    throw Helpers.buildViolatedReqId("9.5.1.0-3", st.id);
                                }

                                if (session.mastery_score) {
                                    const extValue = st.context.extensions["https://w3id.org/xapi/cmi5/context/extensions/masteryscore"];

                                    if (typeof extValue === "undefined") {
                                        throw Helpers.buildViolatedReqId("9.6.3.2-2", `extension missing ${st.id}`);
                                    }
                                    else if (extValue !== session.mastery_score) {
                                        throw Helpers.buildViolatedReqId("9.6.3.2-2", `extension value '${extValue}' does not match session value '${session.mastery_score}' in ${st.id}`);
                                    }
                                }
                            }

                            if (typeof st.result.duration === "undefined") {
                                if (verbId === VERB_TERMINATED_ID) {
                                    throw Helpers.buildViolatedReqId("9.5.4.1-1", st.id);
                                }
                                else if (verbId === VERB_COMPLETED_ID) {
                                    throw Helpers.buildViolatedReqId("9.5.4.1-2", st.id);
                                }
                                else if (verbId === VERB_PASSED_ID) {
                                    throw Helpers.buildViolatedReqId("9.5.4.1-3", st.id);
                                }
                                else if (verbId === VERB_FAILED_ID) {
                                    throw Helpers.buildViolatedReqId("9.5.4.1-4", st.id);
                                }
                            }
                            else {
                                if (verbId === VERB_TERMINATED_ID) {
                                    result.durationMode = session.launch_mode;
                                    result.duration = st.result.duration;
                                }
                            }
                        }

                        switch (verbId) {
                            case VERB_INITIALIZED_ID:
                                if (session.is_initialized || result.statements.includes(VERB_INITIALIZED_ID)) {
                                    throw Helpers.buildViolatedReqId("9.3.0.0-2", `Already initialized: ${st.id}`);
                                }
                                break;

                            case VERB_TERMINATED_ID:
                                if (result.statements.includes(VERB_TERMINATED_ID)) {
                                    throw Helpers.buildViolatedReqId("9.3.0.0-2", `Already terminated: ${st.id}`);
                                }
                                break;

                            case VERB_COMPLETED_ID:
                                if (session.is_completed || result.statements.includes(VERB_COMPLETED_ID)) {
                                    throw Helpers.buildViolatedReqId("9.3.0.0-2", `Already completed: ${st.id}`);
                                }
                                if (regCourseAu.is_completed) {
                                    throw Helpers.buildViolatedReqId("9.3.0.0-6", `Already completed: ${st.id}`);
                                }

                                break;

                            case VERB_PASSED_ID:
                                if (session.mastery_score && st.result.score && st.result.score.scaled < session.mastery_score) {
                                    throw Helpers.buildViolatedReqId("9.3.4.0-2", `Score '${st.result.score.scaled}' less than mastery score '${session.mastery_score}': ${st.id}`);
                                }

                                if (session.is_passed || result.statements.includes(VERB_PASSED_ID)) {
                                    throw Helpers.buildViolatedReqId("9.3.0.0-2", `Already passed: ${st.id}`);
                                }
                                if (session.is_failed || result.statements.includes(VERB_FAILED_ID)) {
                                    throw Helpers.buildViolatedReqId("9.3.0.0-3", `Already failed: ${st.id}`);
                                }
                                if (regCourseAu.is_passed) {
                                    throw Helpers.buildViolatedReqId("9.3.0.0-7", `Already passed: ${st.id}`);
                                }
                                break;

                            case VERB_FAILED_ID:
                                if (session.mastery_score && st.result.score && st.result.score.scaled >= session.mastery_score) {
                                    throw Helpers.buildViolatedReqId("9.3.6.0-1", `Score '${st.result.score.scaled}' greater than or equal to mastery score '${session.mastery_score}': ${st.id}`);
                                }

                                if (session.is_failed || result.statements.includes(VERB_FAILED_ID)) {
                                    throw Helpers.buildViolatedReqId("9.3.0.0-2", `Already failed: ${st.id}`);
                                }
                                if (session.is_passed || result.statements.includes(VERB_PASSED_ID)) {
                                    throw Helpers.buildViolatedReqId("9.3.0.0-3", `Already passed: ${st.id}`);
                                }
                                if (regCourseAu.is_passed) {
                                    throw Helpers.buildViolatedReqId("9.3.0.0-8", `Already passed: ${st.id}`);
                                }
                                break;

                            default:
                                throw Helpers.buildViolatedReqId("9.3.0.0-1", `Unrecognized cmi5 defined statement: ${verbId} - ${st.id}`);
                        }

                        // do this after the checks so that we can check the list for a particular verb
                        result.statements.push(verbId);
                    }
                    else {
                        // cmi5 allowed statement
                        console.log("cmi5 allowed statement", st.verb.id);
                    }
                }
            }
        }
        else if (resource === "activities/state") {
            const msg = `state request: ${req.query.stateId}`;

            let parsedAgent;

            try {
                parsedAgent = JSON.parse(req.query.agent);
            }
            catch (ex) {
                throw Boom.badRequest(`Failed to parse JSON from agent parameter: ${ex}`);
            }

            // all state requests require an actor, and that actor must be the launch actor
            matchActor(parsedAgent, registration.actor, msg);

            if (req.query.registration) {
                matchRegistration(req.query.registration, registration.code, msg);
            }

            if (req.query.stateId === "LMS.LaunchData") {
                if (method === "get") {
                    result.launchData = true;
                }
                else {
                    throw Helpers.buildViolatedReqId("10.2.1.0-5", method);
                }
            }
        }
        else if (resource === "agents") {
            // all agents requests require an actor, and that actor must be the launch actor
            let parsedAgent;

            try {
                parsedAgent = JSON.parse(req.query.agent);
            }
            catch (ex) {
                throw Boom.badRequest(`Failed to parse JSON from agent parameter: ${ex}`);
            }

            matchActor(parsedAgent, registration.actor, `agents request`);
        }
        else if (resource === "agents/profile") {
            // all agents/profile requests require an actor,
            if (typeof req.query.agent === "undefined") {
                throw Helpers.buildViolatedReqId("11.0.0.0-1", "'agent' parameter missing", "badRequest");
            }

            let parsedAgent;

            try {
                parsedAgent = JSON.parse(req.query.agent);
            }
            catch (ex) {
                throw Boom.badRequest(`Failed to parse JSON from agent parameter: ${ex}`);
            }

            // all agents/profile requests require the agent must be the launch actor
            matchActor(parsedAgent, registration.actor, `agents/profile request: ${req.query.profileId}`);

            if (req.query.profileId === "cmi5LearnerPreferences") {
                if (method === "get") {
                    result.learnerPrefs = true;
                }
                else if (method === "delete") {
                    throw Boom.forbidden(new Error("Rejected request to delete the learner preferences Agent Profile document"));
                }
                else if (method === "put" || method === "post") {
                    if (! req.headers["content-type"].startsWith("application/json")) {
                        throw Helpers.buildViolatedReqId("11.0.0.0-5", `Content-Type is not application/json: ${req.headers["content-type"]}`);
                    }

                    if (typeof req.payload.languagePreference === "undefined") {
                        throw Helpers.buildViolatedReqId("11.0.0.0-5", "'languagePreference' property missing");
                    }
                    if (typeof req.payload.audioPreference === "undefined") {
                        throw Helpers.buildViolatedReqId("11.0.0.0-5", "'audioPreference' property missing");
                    }

                    if (! /^[-A-Za-z0-9]+(?:,[-A-Za-z0-9]+)*$/.test(req.payload.languagePreference)) {
                        throw Helpers.buildViolatedReqId("11.1.0.0-1", `'languagePreference' value invalid: '${req.payload.languagePreference}'`);
                    }

                    throw Boom.forbidden(new Error("Rejected request to alter the learner preferences Agent Profile document"));
                }
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
                            sessionUpdates.initialized_at = txn.fn.now();

                            if (! regCourseAu.has_been_attempted && session.launch_mode === "Normal") {
                                registrationCourseAuUpdates = registrationCourseAuUpdates || {};
                                registrationCourseAuUpdates.has_been_attempted = true;
                            }
                            else if (! regCourseAu.has_been_browsed && session.launch_mode === "Browse") {
                                registrationCourseAuUpdates = registrationCourseAuUpdates || {};
                                registrationCourseAuUpdates.has_been_browsed = true;
                            }
                            else if (! regCourseAu.has_been_reviewed && session.launch_mode === "Review") {
                                registrationCourseAuUpdates = registrationCourseAuUpdates || {};
                                registrationCourseAuUpdates.has_been_reviewed = true;
                            }

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

                if (beforeResult.durationMode) {
                    const durationCol = `duration_${beforeResult.durationMode.toLowerCase()}`;

                    sessionUpdates[durationCol] = Iso8601Duration.toSeconds(Iso8601Duration.parse(beforeResult.duration));

                    registrationCourseAuUpdates = registrationCourseAuUpdates || {};
                    registrationCourseAuUpdates[durationCol] = (regCourseAu[durationCol] || 0) + sessionUpdates[durationCol];
                }

                if (registrationCourseAuUpdates) {
                    if (nowSatisfied) {
                        registrationCourseAuUpdates.isSatisfied = true;
                    }

                    try {
                        await txn("registrations_courses_aus").update(registrationCourseAuUpdates).where({id: session.registrations_courses_aus_id});
                    }
                    catch (ex) {
                        throw Boom.internal(new Error(`Failed to update registrations_courses_aus: ${ex}`));
                    }
                }

                if (nowSatisfied) {
                    try {
                        await Registration.interpretMoveOn(
                            registration,
                            {
                                auToSetSatisfied: regCourseAu.courseAu.lms_id,
                                sessionCode: session.code,
                                lrsWreck: Wreck.defaults(await req.server.methods.lrsWreckDefaults(req))
                            }
                        );
                    }
                    catch (ex) {
                        throw Boom.internal(new Error(`Failed to interpret moveOn: ${ex}`));
                    }

                    try {
                        await txn("registrations").update({metadata: JSON.stringify(registration.metadata)}).where({id: registration.id});
                    }
                    catch (ex) {
                        throw Boom.internal(new Error(`Failed to update registration metadata: ${ex}`));
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
            throw Boom.internal(new Error(`Failed to update session: ${ex}`));
        }
    };

//
// all requests here are necessarily made by the AU because any LMS
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
                    const session = await req.server.app.db.first("*").from("sessions").where({launch_token_id: secret.toString()});

                    if (! session) {
                        return {isValid: false, credentials: null};
                    }

                    if (! session.launchTokenFetched) {
                        throw Helpers.buildViolatedReqId("8.1.2.0-2", "Token not yet fetched");
                    }
                    if (session.isTerminated) {
                        throw Helpers.buildViolatedReqId("8.1.2.0-2", "Session terminated");
                    }
                    if (session.isAbandoned) {
                        //
                        // this isn't a spec violation because the AU has no way to have been notified that
                        // the session has been abandoned, so need to reject requests but don't indicate they
                        // have violated the specification, particularly important for the CTS which would
                        // allow the content to continue to run but once the spec is violated there is no way
                        // for otherwise conformant content to indicate a successful test
                        //
                        throw Boom.forbidden(`8.1.2.0-2 - ${Requirements["8.1.2.0-2"].txt} (Session abandoned)`);
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
                        txn = await db.transaction(),
                        {
                            session,
                            regCourseAu,
                            registration,
                            courseAu
                        } = await Session.loadForChange(txn, req.auth.credentials.id, req.auth.credentials.tenantId);
                    let response;

                    try {
                        const beforeResult = beforeLRSRequest(req, session, regCourseAu, registration);

                        const uri = `${req.server.app.lrs.endpoint}${req.params.resource}${req.url.search}`,
                            protocol = uri.split(":", 1)[0],
                            options = {
                                headers: Hoek.clone(req.headers),
                                payload: req.payload
                            };

                        delete options.headers.host;
                        // delete options.headers["content-length"];

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

                            
                        // The cmi5 JS stuff won't know what the configured LRS's xAPI version is
                        // between 1.0.3 and 2.0, so replace that here if it was specified.
                        //
                        let configuredXAPIVersion = process.env.LRS_XAPI_VERSION;
                        if (configuredXAPIVersion != undefined)
                            options.headers["x-experience-api-version"] = configuredXAPIVersion;

                        let lrsResourcePath = req.params.resource;

                            
                        // Concurrency check required or xAPI 2.0
                        //
                        if (req.method == "post" || req.method == "put") {

                            let requiresConcurrency = Helpers.doesLRSResourceEnforceConcurrency(lrsResourcePath);
                            let isMissingEtagHeader = options.headers["if-match"] == undefined;

                            if (requiresConcurrency && isMissingEtagHeader) {

                                let lrsFullQuery = `${req.params.resource}${req.url.search}`;
                                let documentResponse = await Helpers.getDocumentFromLRS(lrsFullQuery);
                                if (documentResponse.exists) {
                                    options.headers["if-match"] = documentResponse.etag;
                                }
                            }
                        }

                        const res = await Wreck.request(req.method, uri, {
                            ...options,
                            timeout: 10000
                        });
                        const payload = await Wreck.read(res);

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
                        await txn.commit();
                    }
                    catch (ex) { 
                        
                        // console.error(ex);

                        await txn.rollback();
                        throw ex;
                    }

                    return response;
                }
            }
        );
    }
};
