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
            throw Boom.unauthorized(new Error(`8.1.3.0-3 - The AU MUST use the "actor" value in xAPI requests that require an "actor" property. (${msg})`));
        }
    },

    matchRegistration = (provided, expected, msg = "") => {
        if (provided !== expected) {
            throw Boom.unauthorized(new Error(`8.1.4.0-3 - The AU MUST use the "registration" value in xAPI requests that require a "registration". (${msg})`));
        }
    },

    matchContextTemplate = (provided, expected, msg = "") => {
        for (const prop of Object.keys(expected)) {
            if (prop === "contextActivities") {
                for (const k of Object.keys(expected[prop])) {
                    for (let i = 0; i < expected[prop][k].length; i += 1) {
                        if (typeof provided[prop][k][i] === "undefined" || provided[prop][k][i].id !== expected[prop][k][i].id) {
                            // also covers 9.6.2.0-1
                            throw Boom.unauthorized(new Error(`10.2.1.0-6 - The AU MUST use the contextTemplate as a template for the "context" property in all xAPI statements it sends to the LMS. (context does not match template: ${prop} ${k} ${i} value differs)`));
                        }
                    }
                }
            }
            else {
                if (typeof provided[prop] === "undefined") {
                    throw Boom.unauthorized(new Error(`10.2.1.0-6 - The AU MUST use the contextTemplate as a template for the "context" property in all xAPI statements it sends to the LMS. (context does not match template: ${prop} missing)`));
                }

                for (const [k, v] of Object.entries(expected[prop])) {
                    if (typeof provided[prop][k] === "undefined" || ! Hoek.deepEqual(provided[prop][k], expected[prop][k])) {
                        throw Boom.unauthorized(new Error(`10.2.1.0-6 - The AU MUST use the contextTemplate as a template for the "context" property in all xAPI statements it sends to the LMS. (context does not match template: ${prop} value differs)`));
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
                    throw Boom.unauthorized(new Error("11.0.0.0-3 - The AU MUST retrieve the Learner Preferences document from the Agent Profile on startup. (Learner Prefs not yet retrieved)"));
                }

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

                    if (st.verb.id === "http://adlnet.gov/expapi/verbs/voided") {
                        throw Boom.unauthorized(new Error(`6.3.0.0-1 - The LMS MUST NOT provide permissions/credentials which allow the AU to issue voiding Statements. (${st.id}`));
                    }

                    if (typeof st.timestamp === "undefined") {
                        throw Boom.unauthorized(new Error(`9.7.0.0-1 - All statements MUST include a timestamp property per the xAPI specification to ensure statement ordering requirements are met. (${st.id})`));
                    }

                    // UTC is "Z", "+00:00", "+0000", or "+00"
                    if (! /(Z|\+00:?(?:00)?)$/.test(st.timestamp)) {
                        throw Boom.unauthorized(new Error(`9.7.0.0-2 - All timestamps MUST be recorded in UTC time. (${st.id})`));
                    }

                    matchActor(st.actor, registration.actor, st.id);

                    if (! st.context) {
                        throw Boom.unauthorized(new Error(`9.6.0.0-1 - All cmi5 defined statements MUST contain a context that includes all properties as defined in this section [9.6]. (no context: ${st.id})`));
                    }
                    if (! st.context.contextActivities) {
                        throw Boom.unauthorized(new Error(`10.2.1.0-6 - The AU MUST use the contextTemplate as a template for the "context" property in all xAPI statements it sends to the LMS. (no contextActivities: ${st.id})`));
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
                        throw Boom.unauthorized(new Error(`9.6.2.2-2 - Other statements [than those with a result.completion or result.success property] MUST NOT include this Activity [the moveOn Category Activity]. (${st.id})`));
                    }
                    if (! st.context.registration) {
                        throw Boom.unauthorized(new Error(`9.6.1.0-1 - The value for the registration property used in the context object MUST be the value provided by the LMS. (registration missing in ${st.id})`));
                    }
                    if (st.context.registration !== registration.code) {
                        throw Boom.unauthorized(new Error(`9.6.1.0-1 - The value for the registration property used in the context object MUST be the value provided by the LMS. (${st.id})`));
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
                    if (session.is_abandoned) {
                        throw Boom.unauthorized(new Error(`9.3.6.0-2 - The LMS MUST NOT allow any statements to be recorded for a session after recording an "Abandoned" statement.). (${st.id})`));
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

                        if (typeof st.object.id === "undefined") {
                            throw Boom.unauthorized(new Error(`9.4.0.0-1 - An Object MUST be present, as specified in this section, in all "cmi5 defined" statements. (${st.id})`));
                        }
                        else if (st.object.id !== regCourseAu.courseAu.lms_id) {
                            // also validates for 9.4.0.0-2
                            throw Boom.unauthorized(new Error(`8.1.5.0-6 - The AU MUST use the "activityId" value as the id property of the Object in all "cmi5 defined" statements. (${st.id})`));
                        }

                        const verbId = st.verb.id;

                        if (session.launch_mode === "Browse" && (verbId === VERB_COMPLETED_ID || verbId === VERB_PASSED_ID || verbId === VERB_FAILED_ID)) {
                            throw Boom.unauthorized(new Error(`10.2.2.0-2 - Browse [launchMode] Indicates to the AU that satisfaction-related data MUST NOT be recorded in the LMS using xAPI statements. (${st.id})`));
                        }
                        else if (session.launch_mode === "Review" && (verbId === VERB_COMPLETED_ID || verbId === VERB_PASSED_ID || verbId === VERB_FAILED_ID)) {
                            throw Boom.unauthorized(new Error(`10.2.2.0-3 - Review [launchMode] Indicates to the AU that satisfaction-related data MUST NOT be recorded in the LMS using xAPI statements. (${st.id})`));
                        }

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
                            else if (verbId === VERB_TERMINATED_ID) {
                                throw Boom.unauthorized(new Error(`9.5.4.1-1 - The AU MUST include the "duration" property in "Terminated" statements. (${st.id})`));
                            }
                        }
                        else {
                            // Note: this has to be an AU request and AUs can't send waived
                            if (typeof st.result.completion !== "undefined" && verbId !== VERB_COMPLETED_ID) {
                                throw Boom.unauthorized(new Error(`9.5.3.0-2 - cmi5 defined statements, other than "Completed" or "Waived", MUST NOT include the "completion" property. (${st.id})`));
                            }
                            else if (verbId === VERB_COMPLETED_ID && st.result.completion !== true) {
                                throw Boom.unauthorized(new Error(`9.5.3.0-1 - The "completion" property of the result MUST be set to true for the following cmi5 defined statements ["Completed", "Waived"]. (${st.id})`));
                            }

                            // Note: this has to be an AU request and AUs can't send waived
                            if (typeof st.result.success !== "undefined" && verbId !== VERB_PASSED_ID && verbId !== VERB_FAILED_ID) {
                                throw Boom.unauthorized(new Error(`9.5.2.0-3 - cmi5 defined statements, other than "Passed", "Waived" or "Failed", MUST NOT include the "success" property. (${st.id})`));
                            }
                            else if (verbId === VERB_PASSED_ID && st.result.success !== true) {
                                throw Boom.unauthorized(new Error(`9.5.2.0-1 - The "success" property of the result MUST be set to true for the following cmi5 defined statements ["Passed", "Waived"]. (${st.id})`));
                            }
                            else if (verbId === VERB_FAILED_ID && st.result.success !== false) {
                                throw Boom.unauthorized(new Error(`9.5.2.0-2 - The "success" property of the result MUST be set to false for the following cmi5 defined statements ["Failed"]. (${st.id})`));
                            }

                            if (
                                (typeof st.result.completion !== "undefined" || typeof st.result.success !== "undefined")
                                && ! st.context.contextActivities.category.some((element) => element.id === CMI5_CATEGORY_ACTIVITY_MOVEON_ID)
                            ) {
                                throw Boom.unauthorized(new Error(`9.6.2.2-1 - cmi5 defined statements with a Result object (Section 9.5) that include either "success" or "completion" properties MUST have an Activity object with an "id" of "https://w3id.org/xapi/cmi5/context/categories/moveon" in the "category" context activities list. (${st.id})`));
                            }

                            if (st.result.score) {
                                if (verbId !== VERB_PASSED_ID && verbId !== VERB_FAILED_ID) {
                                    throw Boom.unauthorized(new Error(`9.5.1.0-2 - cmi5 defined statements, other than "Passed" or "Failed", MUST NOT include the "score" property. (${st.id})`));
                                }

                                if (st.result.score.raw && (typeof st.result.score.min === "undefined" || typeof st.result.score.max === "undefined")) {
                                    throw Boom.unauthorized(new Error(`9.5.1.0-3 - The AU MUST provide the "min" and "max" values for "score" when the "raw" value is provided. (${st.id})`));
                                }

                                if (session.mastery_score) {
                                    const extValue = st.context.extensions["https://w3id.org/xapi/cmi5/context/extensions/masteryscore"];

                                    if (typeof extValue === "undefined") {
                                        throw Boom.unauthorized(new Error(`9.6.3.2-2 - An AU MUST include the "masteryScore" value provided by the LMS in the context as an extension for "passed"/"failed" Statements it makes based on the "masteryScore". (extension missing ${st.id})`));
                                    }
                                    else if (extValue !== session.mastery_score) {
                                        throw Boom.unauthorized(new Error(`9.6.3.2-2 - An AU MUST include the "masteryScore" value provided by the LMS in the context as an extension for "passed"/"failed" Statements it makes based on the "masteryScore". (extension value '${extValue}' does not match session value '${session.mastery_score}' ${st.id})`));
                                    }
                                }
                            }

                            if (typeof st.result.duration === "undefined") {
                                if (verbId === VERB_TERMINATED_ID) {
                                    throw Boom.unauthorized(new Error(`9.5.4.1-1 - The AU MUST include the "duration" property in "Terminated" statements. (${st.id})`));
                                }
                                else if (verbId === VERB_COMPLETED_ID) {
                                    throw Boom.unauthorized(new Error(`9.5.4.1-2 - The AU MUST include the "duration" property in "Completed" statements. (${st.id})`));
                                }
                                else if (verbId === VERB_PASSED_ID) {
                                    throw Boom.unauthorized(new Error(`9.5.4.1-3 - The AU MUST include the "duration" property in "Passed" statements. (${st.id})`));
                                }
                                else if (verbId === VERB_FAILED_ID) {
                                    throw Boom.unauthorized(new Error(`9.5.4.1-4 - The AU MUST include the "duration" property in "Failed" statements. (${st.id})`));
                                }
                            }
                        }

                        switch (verbId) {
                            case VERB_INITIALIZED_ID:
                                if (session.is_initialized || result.statements.includes(VERB_INITIALIZED_ID)) {
                                    throw Boom.unauthorized(new Error(`9.3.0.0-2 - Verbs MUST NOT be duplicated (in cmi5 defined statements). (Already initialized: ${st.id})`));
                                }
                                break;

                            case VERB_TERMINATED_ID:
                                if (result.statements.includes(VERB_TERMINATED_ID)) {
                                    throw Boom.unauthorized(new Error(`9.3.0.0-2 - Verbs MUST NOT be duplicated (in cmi5 defined statements). (Already terminated: ${st.id})`));
                                }
                                break;

                            case VERB_COMPLETED_ID:
                                if (session.is_completed || result.statements.includes(VERB_COMPLETED_ID)) {
                                    throw Boom.unauthorized(new Error(`9.3.0.0-2 - Verbs MUST NOT be duplicated (in cmi5 defined statements). (Already completed: ${st.id})`));
                                }
                                if (regCourseAu.is_completed) {
                                    throw Boom.unauthorized(new Error(`9.3.0.0-6 - Exactly zero or one "Completed" cmi5 defined statement MUST be used per registration. (Already completed: ${st.id})`));
                                }

                                break;

                            case VERB_PASSED_ID:
                                if (session.mastery_score && st.result.score && st.result.score.scaled < session.mastery_score) {
                                    throw Boom.unauthorized(new Error(`9.3.4.0-2 - If the "Passed" statement contains a (scaled) score, the (scaled) score MUST be equal to or greater than the "masteryScore" indicated in the LMS Launch Data. (Score '${st.result.score.scaled}' less than mastery score '${session.mastery_score}': ${st.id})`));
                                }

                                if (session.is_passed || result.statements.includes(VERB_PASSED_ID)) {
                                    throw Boom.unauthorized(new Error(`9.3.0.0-2 - Verbs MUST NOT be duplicated (in cmi5 defined statements). (Already passed: ${st.id})`));
                                }
                                if (session.is_failed || result.statements.includes(VERB_FAILED_ID)) {
                                    throw Boom.unauthorized(new Error(`9.3.0.0-3 - More than one of the set of {"Passed","Failed"} verbs MUST NOT be used (in cmi5 defined statements). (Already failed: ${st.id})`));
                                }
                                if (regCourseAu.is_passed) {
                                    throw Boom.unauthorized(new Error(`9.3.0.0-7 - Exactly zero or one "Passed" cmi5 defined statement MUST be used per registration. (Already passed: ${st.id})`));
                                }
                                break;

                            case VERB_FAILED_ID:
                                if (session.mastery_score && st.result.score && st.result.score.scaled >= session.mastery_score) {
                                    throw Boom.unauthorized(new Error(`9.3.6.0-1 - If the "Failed" statement contains a (scaled) score, the (scaled) score MUST be less than the "masteryScore" indicated in the LMS Launch Data. (Score '${st.result.score.scaled}' greater than or equal to mastery score '${session.mastery_score}': ${st.id})`));
                                }

                                if (session.is_failed || result.statements.includes(VERB_FAILED_ID)) {
                                    throw Boom.unauthorized(new Error(`9.3.0.0-2 - Verbs MUST NOT be duplicated (in cmi5 defined statements). (Already failed: ${st.id})`));
                                }
                                if (session.is_passed || result.statements.includes(VERB_PASSED_ID)) {
                                    throw Boom.unauthorized(new Error(`9.3.0.0-3 - More than one of the set of {"Passed","Failed"} verbs MUST NOT be used (in cmi5 defined statements). (Already passed: ${st.id})`));
                                }
                                if (regCourseAu.is_passed) {
                                    throw Boom.unauthorized(new Error(`9.3.0.0-8 - A "Failed" statement MUST NOT follow a "Passed" statement (in cmi5 defined statements) per registration. (Already passed: ${st.id})`));
                                }
                                break;

                            default:
                                throw Boom.unauthorized(new Error(`9.3.0.0-1 - AUs MUST use the below verbs that are indicated as mandatory in other sections of this specification. (Unrecognized cmi5 defined statement: ${verbId} - ${st.id})`));
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
                    throw Boom.unauthorized(new Error(`10.2.1.0-5 - The AU MUST NOT modify or delete the "LMS.LaunchData" State document. (${method}`));
                }
            }
        }
        else if (resource === "agents") {
            // all agents requests require an actor, and that actor must be the launch actor
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
                throw Boom.unauthorized(new Error("11.0.0.0-1 - The Agent used in xAPI Agent Profile requests MUST match the actor property generated by the LMS at AU launch time. ('agent' parameter missing"));
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
                    throw Boom.unauthorized(new Error("Rejected request to delete the learner preferences Agent Profile document"));
                }
                else if (method === "put" || method === "post") {
                    if (! req.headers["content-type"].startsWith("application/json")) {
                        throw Boom.unauthorized(new Error(`11.0.0.0-5 - The [Agent Profile] document content MUST be a JSON object with the "languagePreference" and "audioPreference" properties as described in Section 11.1 and 11.2. (Content-Type is not application/json: ${req.headers["content-type"]}`));
                    }

                    if (typeof req.payload.languagePreference === "undefined") {
                        throw Boom.unauthorized(new Error(`11.0.0.0-5 - The [Agent Profile] document content MUST be a JSON object with the "languagePreference" and "audioPreference" properties as described in Section 11.1 and 11.2. ('languagePreference' property missing)`));
                    }
                    if (typeof req.payload.audioPreference === "undefined") {
                        throw Boom.unauthorized(new Error(`11.0.0.0-5 - The [Agent Profile] document content MUST be a JSON object with the "languagePreference" and "audioPreference" properties as described in Section 11.1 and 11.2. ('audioPreference' property missing)`));
                    }

                    if (! /^[-A-Za-z0-9]+(?:,[-A-Za-z0-9])*$/.test(req.payload.languagePreference)) {
                        throw Boom.unauthorized(new Error(`11.1.0.0-1 - The languagePreference MUST be a comma-separated list of RFC 5646 Language Tags as indicated in the xAPI specification (Section 5.2). ('languagePreference' value invalid: '${req.payload.languagePreference}')`));
                    }

                    throw Boom.unauthorized(new Error("Rejected request to alter the learner preferences Agent Profile document"));
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

                    if (! session.launchTokenFetched) {
                        throw Boom.unauthorized("8.1.2.0-2 - The authorization token returned by the \"fetch\" URL MUST be limited to the duration of a specific user session. (Token not yet fetched)");
                    }
                    if (session.isTerminated) {
                        throw Boom.unauthorized("8.1.2.0-2 - The authorization token returned by the \"fetch\" URL MUST be limited to the duration of a specific user session. (Session terminated)");
                    }
                    if (session.isAbandoned) {
                        throw Boom.unauthorized("8.1.2.0-2 - The authorization token returned by the \"fetch\" URL MUST be limited to the duration of a specific user session. (Session abandoned)");
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
