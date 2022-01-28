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
import Cmi5 from "@rusticisoftware/cmi5";
import Helpers from "../lib/helpers";

const saveLearnerPrefs = async (
        cmi5,
        reqId,
        {
            noActor = false,
            wrongActor = false,
            noContentType = false,
            nonObject = false,
            missingLanguage = false,
            missingAudio = false,
            invalidLangPref = false,
            emptyLangPref = false,
            debug = false
        }
    ) => {
        try {
            const params = {
                    profileId: "cmi5LearnerPreferences"
                },
                headers = {
                    "X-Experience-API-Version": "1.0.3",
                    Authorization: cmi5.getAuth()
                };
            let body = {
                languagePreference: "en-US,fr-FR,fr-BE",
                audioPreference: "on"
            };

            if (wrongActor) {
                params.agent = JSON.stringify({
                    mbox: "mailto:catapult@example.com"
                });
            }
            else if (! noActor) {
                params.agent = JSON.stringify(cmi5.getActor());
            }

            if (! noContentType) {
                headers["Content-Type"] = "application/json";
            }
            if (nonObject) {
                headers["Content-Type"] = "text/plain";
                body = "just some text";
            }
            else {
                if (missingLanguage) {
                    delete body.languagePreference;
                }
                else if (invalidLangPref) {
                    body.languagePreference = "not comma separated";
                }
                else if (emptyLangPref) {
                    body.languagePreference = "";
                }

                if (missingAudio) {
                    delete body.audioPreference;
                }

                body = JSON.stringify(body);
            }

            const response = await fetch(
                    `${cmi5.getEndpoint()}/agents/profile?` + new URLSearchParams(params),
                    {
                        method: "PUT",
                        mode: "cors",
                        headers,
                        body
                    }
                ),
                responseContent = await response.text();

            if (debug) {
                console.log(reqId, responseContent);
            }

            if (response.status === 204 || response.status === 200) {
                Helpers.storeResult(false, false, {reqId, msg: `Request not rejected (${response.status})`});

                return false;
            }
            // If no actor is provided to an agent profile endpoint, xAPI rules apply and requires a 400, not a 403.
            else if (noActor) {
                if (response.status !== 400) {
                    Helpers.storeResult(false, false, {reqId, msg: `Save learner preferences with no actor query param should have responded with a status code: 400, but instead had a response status code: ${response.status} ${responseContent} (Testing ${reqId})`});

                    return false;
                }
            }
            // this treats other non-403 (like 400, 500, etc.) as not acceptable responses
            // for denying the request
            // eslint-disable-next-line no-magic-numbers
            else if (response.status !== 403) {
                Helpers.storeResult(false, false, {reqId: "4.2.0.0-2", msg: `Save learner preferences response status code: ${response.status} ${responseContent} (Testing ${reqId})`});

                return false;
            }
        }
        catch (ex) {
            // request should succeed but provide a 403, so an exception here is an error
            Helpers.storeResult(false, true, {reqId, msg: `Failed request to save learner preferences: ${ex}`});

            return false;
        }

        return true;
    },
    /* eslint-disable padding-line-between-statements */
    // eslint-disable-next-line complexity
    execute = async () => {
        const cmi5 = await Helpers.initCmi5();

        if (! cmi5) {
            return;
        }

        // set this privately because the launch data hasn't been fetched yet
        // and so there needs to be an object that a registration can be set in
        cmi5._contextTemplate = "{}";

        const preInitializedSt = cmi5.prepareStatement("http://adlnet.gov/expapi/verbs/experienced");

        //
        // send statement prior to getting auth token, with value
        //
        cmi5.setAuth("Basic Y2F0YXB1bHQ6ZmlyZSBzb21lIFJ1c3RpY2kgU29mdHdhcmUgcm9ja3Mh");
        if (! await Helpers.sendStatement(cmi5, preInitializedSt, "8.1.2.0-2 (d)", {shouldSucceed: false, acceptUnauthorized: true})) {
            return;
        }

        try {
            await cmi5.postFetch();
        }
        catch (ex) {
            Helpers.storeResult(false, true, {msg: `Failed to start AU at POSTing to the fetch URL: ${ex}`});
            return;
        }

        try {
            await cmi5.loadLMSLaunchData();
        }
        catch (ex) {
            Helpers.storeResult(false, true, {msg: `Failed to start AU at loading LMS Launch Data: ${ex}`});
            return;
        }

        //
        // send statement before loading learner prefs
        //
        if (! await Helpers.sendStatement(cmi5, cmi5.initializedStatement(), "11.0.0.0-3 (d2)")) {
            return;
        }

        try {
            await cmi5.loadLearnerPrefs();
        }
        catch (ex) {
            Helpers.storeResult(false, true, {msg: `Failed to start AU at loading Learner Prefs: ${ex}`});
            return;
        }

        //
        // try to post to the fetch URL again which should be rejected
        // but with a 200 status and an error object
        // Validates 8.2.3.0-1 (d)
        //
        try {
            const secondFetchResponse = await fetch(
                cmi5.getFetch(),
                {
                    method: "POST",
                    mode: "cors"
                }
            );

            if (secondFetchResponse.status !== 200) {
                Helpers.storeResult(false, false, {reqId: "8.2.2.0-3", msg: `Response status not 200: ${secondFetchResponse.status}`});
                return;
            }

            let secondFetchContent = await secondFetchResponse.text();

            try {
                secondFetchContent = JSON.parse(secondFetchContent);
            }
            catch (ex) {
                Helpers.storeResult(false, false, {reqId: "8.2.1.0-3", msg: `Failed to parse JSON response: ${ex}`});
                return;
            }

            if (typeof secondFetchContent["auth-token"] !== "undefined") {
                Helpers.storeResult(false, false, {reqId: "8.2.3.0-1", msg: `auth-token included in response but should not be: ${secondFetchContent["auth-token"]}`});
                return;
            }

            if (! ["1", "2", "3"].includes(secondFetchContent["error-code"])) {
                Helpers.storeResult(false, false, {reqId: "8.2.3.2-1", msg: `Unrecognized error-code: ${secondFetchContent["error-code"]}`});
                return;
            }
        }
        catch (ex) {
            Helpers.storeResult(false, true, {msg: `Failed to make second fetch request: ${ex}`});
            return;
        }

        //
        // try to save or delete the LMS Launch Data which may
        // only be fetched by the AU
        //
        try {
            const writeLaunchDataResponse = await fetch(
                `${cmi5.getEndpoint()}/activities/state?` + new URLSearchParams(
                    {
                        stateId: "LMS.LaunchData",
                        activityId: cmi5.getActivityId(),
                        agent: JSON.stringify(cmi5.getActor()),
                        registration: cmi5.getRegistration()
                    }
                ),
                {
                    method: "PUT",
                    mode: "cors",
                    headers: {
                        "X-Experience-API-Version": "1.0.3",
                        Authorization: cmi5.getAuth(),
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({test: true})
                }
            );

            if (writeLaunchDataResponse.status === 200 || writeLaunchDataResponse.status === 204) {
                Helpers.storeResult(false, false, {reqId: "10.2.1.0-5 (d)", msg: `Response status indicates successful save when shouldn't: ${writeLaunchDataResponse.status}`});
                return;
            }
        }
        catch (ex) {
            Helpers.storeResult(false, true, {msg: `Failed to post state request: ${ex}`});
            return;
        }

        try {
            const deleteLaunchDataResponse = await fetch(
                `${cmi5.getEndpoint()}/activities/state?` + new URLSearchParams(
                    {
                        stateId: "LMS.LaunchData",
                        activityId: cmi5.getActivityId(),
                        agent: JSON.stringify(cmi5.getActor()),
                        registration: cmi5.getRegistration()
                    }
                ),
                {
                    method: "DELETE",
                    mode: "cors",
                    headers: {
                        "X-Experience-API-Version": "1.0.3",
                        Authorization: cmi5.getAuth()
                    }
                }
            );

            if (deleteLaunchDataResponse.status === 204) {
                Helpers.storeResult(false, false, {reqId: "10.2.1.0-5 (d)", msg: `Response status indicates successful delete when shouldn't: ${deleteLaunchDataResponse.status}`});
                return;
            }
        }
        catch (ex) {
            Helpers.storeResult(false, true, {msg: `Failed to post state request: ${ex}`});
            return;
        }

        //
        // save learner prefs without an actor (this could be any Agent profile but this is the most likely)
        //
        if (! await saveLearnerPrefs(cmi5, "11.0.0.0-1 (d)", {noActor: true})) {
            return;
        }

        //
        // save learner prefs with an agent that is not the actor (this could be any Agent profile but this is the most likely)
        //
        if (! await saveLearnerPrefs(cmi5, "11.0.0.0-1 (d)", {wrongActor: true})) {
            return;
        }

        //
        // save learner prefs with various invalid requests
        //
        for (const setting of ["noContentType", "nonObject", "missingLanguage", "missingAudio"]) {
            // eslint-disable-next-line no-await-in-loop
            if (! await saveLearnerPrefs(cmi5, "11.0.0.0-5 (d)", {[setting]: true})) {
                return;
            }
        }

        //
        // save learner prefs with invalid language preference values
        //
        for (const setting of ["invalidLangPref", "emptyLangPref"]) {
            // eslint-disable-next-line no-await-in-loop
            if (! await saveLearnerPrefs(cmi5, "11.1.0.0-1 (d)", {[setting]: true})) {
                return;
            }
        }

        //
        // send statement before initialized
        // Also validates 7.1.1.0-1 (d2)
        //
        if (! await Helpers.sendStatement(cmi5, preInitializedSt, "9.3.0.0-4 (d2)")) {
            return;
        }

        await cmi5.initialize();

        //
        // send statement without auth token
        //
        const origAuth = cmi5.getAuth();

        cmi5.setAuth("");
        if (! await Helpers.sendStatement(cmi5, preInitializedSt, "8.1.2.0-5 (d)", {shouldSucceed: false, acceptUnauthorized: true})) {
            return;
        }

        cmi5.setAuth(origAuth);

        //
        // send a statement that should be stored so that we can then test voiding it
        //
        const allowedSt = cmi5.prepareStatement("http://adlnet.gov/expapi/verbs/experienced");

        try {
            await cmi5.sendStatement(allowedSt);
        }
        catch (ex) {
            Helpers.storeResult(false, false, {reqId: "9.3.0.0-9", msg: `Failed to send allowed statement: ${ex}`});
            return;
        }

        const voidedSt = cmi5.prepareStatement("http://adlnet.gov/expapi/verbs/voided");

        voidedSt.object = {
            id: allowedSt.id,
            objectType: "StatementRef"
        };

        //
        // send voiding statement to be rejected
        //
        if (! await Helpers.sendStatement(cmi5, voidedSt, "6.3.0.0-1")) {
            return;
        }

        //
        // create a set of statement templates that should be valid so that they can be used as is
        // or by altering them in some way to make them invalid to check that they are rejected
        //
        const stTemplates = {
            allowed: JSON.stringify(cmi5.prepareStatement("http://adlnet.gov/expapi/verbs/experienced")),
            initialized: JSON.stringify(cmi5.initializedStatement()),
            completed: JSON.stringify(cmi5.completedStatement()),
            passed: JSON.stringify(
                cmi5.passedStatement(
                    {
                        min: 0,
                        max: 100,
                        scaled: 0.9,
                        raw: 90
                    }
                )
            ),
            failed: JSON.stringify(
                cmi5.failedStatement(
                    {
                        min: 0,
                        max: 100,
                        scaled: 0.89,
                        raw: 89
                    }
                )
            ),
            terminated: JSON.stringify(cmi5.terminatedStatement())
        };

        for (const stDef of [
            {
                // statement without an id
                reqId: "9.1.0.0-1 (d)",
                alter: (st) => delete st.id,
                cfg: {method: "post"}
            },
            {
                // statement without a timestamp
                reqId: "9.7.0.0-1 (d)",
                alter: (st) => delete st.timestamp
            },
            {
                // statement with a non-UTC timestamp
                reqId: "9.7.0.0-2 (d)",
                alter: (st) => {
                    st.timestamp = st.timestamp.replace("Z", "-06:00");
                }
            },
            {
                // defined statement with actor objectType set to "Group"
                reqId: "9.2.0.0-2",
                type: "passed",
                alter: (st) => {
                    st.actor.objectType = "Group";
                }
            },
            {
                // defined statement with actor objectType set to an invalid value
                reqId: "9.2.0.0-2",
                type: "passed",
                alter: (st) => {
                    st.actor.objectType = "Unknown";
                },
                cfg: {
                    expectedStatuses: [400, 403]
                }
            },
            {
                // defined statement with actor using an mbox IFI instead of account
                reqId: "9.2.0.0-3",
                type: "passed",
                alter: (st) => {
                    delete st.actor.account;
                    st.actor.mbox = "mailto:catapult@example.com";
                }
            },
            {
                // initialized verb sent after already initialized
                // Also validates: 9.3.0.0-2 (d)
                reqId: "9.3.2.0-3 (d)",
                type: "initialized"
            },
            {
                // statement with incorrect object id
                // Also validates: 9.4.0.0-1 (d)
                reqId: "8.1.5.0-6 (d)",
                type: "passed",
                alter: (st) => {
                    st.object.id = "http://example.com/not/the/lms/id";
                }
            },
            {
                // statement without context
                reqId: "9.6.0.0-1 (d)",
                type: "passed",
                alter: (st) => {
                    delete st.context;
                }
            },
            {
                // statement without registration
                // Also validates part of: 8.1.4.0-3 (d)
                reqId: "9.6.1.0-1 (d)",
                type: "passed",
                alter: (st) => {
                    delete st.context.registration;
                }
            },
            {
                // statement with incorrect registration
                // Also validates part of: 8.1.4.0-3 (d)
                reqId: "9.6.1.0-1 (d)",
                type: "passed",
                alter: (st) => {
                    st.context.registration = "ccaf384c-f8d4-4e7a-8304-49af58f0b176";
                }
            },
            {
                // passed verb with result.completion
                reqId: "9.5.3.0-2 (d)",
                type: "passed",
                alter: (st) => {
                    st.result.completion = true;
                }
            },
            {
                // completed verb with result.success
                reqId: "9.5.2.0-3 (d)",
                type: "completed",
                alter: (st) => {
                    st.result.success = true;
                }
            },
            {
                // completed verb without result.completion
                reqId: "9.5.3.0-1 (d1)",
                type: "completed",
                alter: (st) => {
                    delete st.result.completion;
                }
            },
            {
                // completed verb with incorrect result.completion
                reqId: "9.5.3.0-1 (d1)",
                type: "completed",
                alter: (st) => {
                    st.result.completion = false;
                }
            },
            {
                // completed verb with score
                reqId: "9.5.1.0-2 (d)",
                type: "completed",
                alter: (st) => {
                    st.result.score = {
                        raw: 50,
                        scaled: 0.5,
                        min: 0,
                        max: 100
                    };
                }
            },
            {
                // terminated verb without result (and therefore no duration)
                reqId: "9.5.4.1-1 (d)",
                type: "terminated",
                alter: (st) => {
                    delete st.result;
                }
            },
            {
                // terminated verb without duration
                reqId: "9.5.4.1-1 (d)",
                type: "terminated",
                alter: (st) => {
                    delete st.result.duration;
                }
            },
            {
                // completed verb without duration
                reqId: "9.5.4.1-2 (d)",
                type: "completed",
                alter: (st) => {
                    delete st.result.duration;
                }
            },
            {
                // passed verb without duration
                reqId: "9.5.4.1-3 (d)",
                type: "passed",
                alter: (st) => {
                    delete st.result.duration;
                }
            },
            {
                // failed verb without duration
                reqId: "9.5.4.1-4 (d)",
                type: "failed",
                alter: (st) => {
                    delete st.result.duration;
                }
            },
            {
                // completed verb sent to succeed
                type: "completed",
                cfg: {
                    shouldSucceed: true
                }
            },
            {
                // completed verb after completed has already occurred same session
                reqId: "9.3.0.0-2 (d)",
                type: "completed"
            },
            {
                // passed verb without result.success
                reqId: "9.5.2.0-1 (d1)",
                type: "passed",
                alter: (st) => {
                    delete st.result.success;
                }
            },
            {
                // passed verb with incorrect result.success
                reqId: "9.5.2.0-1 (d1)",
                type: "passed",
                alter: (st) => {
                    st.result.success = false;
                }
            },
            {
                // failed verb without result.success
                reqId: "9.5.2.0-2 (d)",
                type: "failed",
                alter: (st) => {
                    delete st.result.success;
                }
            },
            {
                // failed verb with incorrect result.success
                reqId: "9.5.2.0-2 (d)",
                type: "failed",
                alter: (st) => {
                    st.result.success = true;
                }
            },
            {
                // passed verb with score below masteryScore
                reqId: "9.3.4.0-2 (d2)",
                type: "passed",
                alter: (st) => {
                    st.result.score = {
                        scaled: 0.89
                    };
                }
            },
            {
                // failed verb with score equal to masteryScore
                reqId: "9.3.5.0-2 (d)",
                type: "failed",
                alter: (st) => {
                    st.result.score = {
                        scaled: 0.9
                    };
                }
            },
            {
                // failed verb with score greater than masteryScore
                reqId: "9.3.5.0-2 (d)",
                type: "failed",
                alter: (st) => {
                    st.result.score = {
                        scaled: 0.91
                    };
                }
            },
            {
                // passed verb with raw score without min
                reqId: "9.5.1.0-3 (d1)",
                type: "passed",
                alter: (st) => {
                    delete st.result.score.min;
                }
            },
            {
                // passed verb with raw score without max
                reqId: "9.5.1.0-3 (d2)",
                type: "passed",
                alter: (st) => {
                    delete st.result.score.max;
                }
            },
            {
                // completed verb without moveOn category activity
                reqId: "9.6.2.2-1 (d1)",
                type: "completed",
                alter: (st) => {
                    st.context.contextActivities.category.pop();
                }
            },
            {
                // passed verb without moveOn category activity
                reqId: "9.6.2.2-1 (d2)",
                type: "passed",
                alter: (st) => {
                    st.context.contextActivities.category.pop();
                }
            },
            {
                // failed verb without moveOn category activity
                reqId: "9.6.2.2-1 (d3)",
                type: "failed",
                alter: (st) => {
                    st.context.contextActivities.category.pop();
                }
            },
            {
                // allowed verb with moveOn category activity
                reqId: "9.6.2.2-2 (d)",
                alter: (st) => {
                    st.context.contextActivities.category = [];
                    st.context.contextActivities.category.push(
                        {
                            id: "https://w3id.org/xapi/cmi5/context/categories/moveon"
                        }
                    );
                }
            },
            {
                // terminated (cmi5 defined) verb with moveOn category activity that isn't passed, failed, or completed
                reqId: "9.6.2.2-2 (d)",
                type: "terminated",
                alter: (st) => {
                    st.context.contextActivities.category.push(
                        {
                            id: "https://w3id.org/xapi/cmi5/context/categories/moveon"
                        }
                    );
                }
            },
            {
                // passed verb without masteryScore extension
                reqId: "9.6.3.2-2 (d)",
                type: "passed",
                alter: (st) => {
                    delete st.context.extensions["https://w3id.org/xapi/cmi5/context/extensions/masteryscore"];
                }
            },
            {
                // passed verb with incorrect masteryScore extension
                reqId: "9.6.3.2-2 (d)",
                type: "passed",
                alter: (st) => {
                    st.context.extensions["https://w3id.org/xapi/cmi5/context/extensions/masteryscore"] = 0.8;
                }
            },
            {
                // statement without a session id
                reqId: "9.6.3.1-4 (d)",
                alter: (st) => delete st.context.extensions["https://w3id.org/xapi/cmi5/context/extensions/sessionid"]
            },
            {
                // passed verb sent to succeed
                type: "passed",
                cfg: {
                    shouldSucceed: true
                }
            },
            {
                // passed verb after passed has already occurred same session
                reqId: "9.3.0.0-2 (d)",
                type: "passed"
            },
            {
                // failed verb after passed has already occurred
                reqId: "9.3.0.0-8 (d)",
                type: "failed"
            }
        ]) {
            const st = JSON.parse(stTemplates[stDef.type || "allowed"]);

            // using the template in the way that this is doing so means there would be
            // the same statement id with all statements of a kind so generate a new one
            st.id = Cmi5.uuidv4();

            if (stDef.alter) {
                stDef.alter(st);
            }

            // eslint-disable-next-line no-await-in-loop
            if (! await Helpers.sendStatement(cmi5, st, stDef.reqId, stDef.cfg)) {
                return;
            }
        }

        await cmi5.terminate();

        //
        // send statement after terminated
        // Also validates: 9.3.0.0-2 (d)
        //
        if (! await Helpers.sendStatement(cmi5, allowedSt, "9.3.0.0-5 (d2)", {shouldSucceed: false, acceptUnauthorized: true})) {
            return;
        }

        // confirm other xAPI requests are rejected as well
        try {
            const response = await fetch(
                `${cmi5.getEndpoint()}/activities/state?` + new URLSearchParams(
                    {
                        agent: JSON.stringify(cmi5.getActor()),
                        activityId: cmi5.getActivityId(),
                        registration: cmi5.getRegistration(),
                        stateId: "008-1-abandoned"
                    }
                ),
                {
                    method: "get",
                    mode: "cors",
                    headers: {
                        "X-Experience-API-Version": "1.0.3",
                        Authorization: cmi5.getAuth()
                    }
                }
            );

            // 8.1.2.0-2 (d) - requests using auth token after abandoned
            if (response.status === 200 || response.status === 204) {
                Helpers.storeResult(false, false, {reqId: "8.1.2.0-2 (d)", msg: `Response status indicates successful get state when shouldn't: ${response.status}`});

                return;
            }
        }
        catch (ex) {
            Helpers.storeResult(false, true, {msg: `Failed to get state request: ${ex}`});

            return;
        }

        Helpers.storeResult(true, false, {msg: "LMS rejected set of statements with 403 response status"});
    };
    /* eslint-enable padding-line-between-statements */

execute();
