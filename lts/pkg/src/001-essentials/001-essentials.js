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
import Helpers from "../lib/helpers";
import Cmi5 from "@rusticisoftware/cmi5";

/* eslint-disable padding-line-between-statements */
// eslint-disable-next-line complexity
const execute = async () => {
    try {
        const launchString = window.document.location.href;

        let launchUrl;

        try {
            launchUrl = new URL(launchString);
        }
        catch (ex) {
            Helpers.storeResult(false, false, {reqId: "8.1.0.0-4", msg: `Failed to parse URL: ${ex}`});
            return;
        }

        if (! launchUrl.pathname.endsWith("/index.html")) {
            Helpers.storeResult(false, false, {reqId: "8.1.0.0-5", msg: "Path does not match '/index.html'"});
            return;
        }
        if (launchUrl.search === "") {
            Helpers.storeResult(false, false, {reqId: "8.1.0.0-5", msg: "No query string parameters"});
            return;
        }

        const launchUrlParams = launchUrl.searchParams,
            endpoint = launchUrlParams.get("endpoint"),
            fetchUrl = launchUrlParams.get("fetch"),
            actor = launchUrlParams.get("actor"),
            registration = launchUrlParams.get("registration"),
            activityId = launchUrlParams.get("activityId");

        if (! endpoint || endpoint === "") {
            Helpers.storeResult(false, false, {reqId: "8.1.1.0-1", msg: "'endpoint' missing"});
            return;
        }

        if (! fetchUrl || fetchUrl === "") {
            Helpers.storeResult(false, false, {reqId: "8.1.2.0-1", msg: "'fetch' missing"});
            return;
        }

        if (! actor || actor === "") {
            Helpers.storeResult(false, false, {reqId: "8.1.3.0-1", msg: "'actor' missing"});
            return;
        }

        let actorObj;

        try {
            actorObj = JSON.parse(actor);
        }
        catch (ex) {
            Helpers.storeResult(false, false, {reqId: "8.1.3.0-1", msg: `Failed to parse 'actor' as JSON: ${ex}`});
            return;
        }

        if (! actorObj.account || ! actorObj.account.name || ! actorObj.account.homePage) {
            Helpers.storeResult(false, false, {reqId: "8.1.3.0-1", msg: "Invalid xAPI Agent used as 'actor'"});
            return;
        }
        if (actorObj.objectType && actorObj.objectType !== "Agent") {
            Helpers.storeResult(false, false, {reqId: "9.2.0.0-2", msg: `"actor" not an Agent: ${actorObj.objectType}`});
            return;
        }

        if (! registration || registration === "") {
            Helpers.storeResult(false, false, {reqId: "8.1.4.0-1", msg: "'registration' missing"});
            return;
        }
        if (! activityId || activityId === "") {
            Helpers.storeResult(false, false, {reqId: "8.1.5.0-2", msg: "'activityId' missing"});
            return;
        }
        if (activityId === "https://w3id.org/xapi/cmi5/catapult/lts/au/001-essentials") {
            Helpers.storeResult(false, false, {reqId: "8.1.5.0-3", msg: "activityId matches publisher id"});
            return;
        }

        if (! launchUrlParams.get("paramA") || launchUrlParams.get("paramA") !== "1" || ! launchUrlParams.get("paramB") || launchUrlParams.get("paramB") !== "2") {
            Helpers.storeResult(false, false, {reqId: "13.1.4.0-3", msg: "Parameters from cmi5.xml are missing or invalid"});
            return;
        }

        let fetchUrlResponse;

        try {
            fetchUrlResponse = await fetch(
                fetchUrl,
                {
                    method: "POST",
                    mode: "cors"
                }
            );
        }
        catch (ex) {
            Helpers.storeResult(false, true, {reqId: "8.2.1.0-2 (derived)", msg: `Failed to make fetch request '${fetchUrl}': ${ex}`});
            return;
        }

        if (fetchUrlResponse.status !== 200) {
            Helpers.storeResult(false, false, {reqId: "8.2.2.0-3", msg: `Status code: ${fetchUrlResponse.status}`});
            return;
        }

        if (! fetchUrlResponse.headers.get("Content-Type")) {
            Helpers.storeResult(false, false, {reqId: "8.2.2.0-2", msg: "'Content-Type' header missing"});
            return;
        }
        else if (! fetchUrlResponse.headers.get("Content-Type").startsWith("application/json")) {
            Helpers.storeResult(false, false, {reqId: "8.2.2.0-2", msg: `Content-Type: '${fetchUrlResponse.headers.get("Content-Type")}'`});
            return;
        }

        let fetchUrlContent;

        try {
            fetchUrlContent = await fetchUrlResponse.json();
        }
        catch (ex) {
            Helpers.storeResult(false, false, {reqId: "8.2.1.0-3", msg: `Failed to get JSON body: ${ex}`});
            return;
        }

        if (! fetchUrlContent["auth-token"]) {
            Helpers.storeResult(false, false, {reqId: "8.2.2.0-1", msg: "\"auth-token\" property missing."});
            return;
        }

        const authHeader = `Basic ${fetchUrlContent["auth-token"]}`;

        let launchDataResponse;

        try {
            launchDataResponse = await fetch(
                `${endpoint}/activities/state?` + new URLSearchParams(
                    {
                        stateId: "LMS.LaunchData",
                        // tests 10.1.0.0-3
                        activityId,
                        // tests 10.1.0.0-4
                        agent: actor,
                        // tests 10.1.0.0-5
                        registration
                    }
                ),
                {
                    method: "GET",
                    mode: "cors",
                    headers: {
                        "X-Experience-API-Version": "1.0.3",
                        Authorization: authHeader
                    }
                }
            );
        }
        catch (ex) {
            Helpers.storeResult(false, true, {msg: `Failed request to get LMS.LaunchData document: ${ex}`});
            return;
        }

        let launchDataContent;

        if (launchDataResponse.status === 200) {
            launchDataContent = await launchDataResponse.text();

            try {
                launchDataContent = JSON.parse(launchDataContent);
            }
            catch (ex) {
                Helpers.storeResult(false, false, {reqId: "10.1.0.0-2", msg: `Failed to get/parse JSON body: ${ex}`});
                return;
            }
        }
        else if (launchDataResponse.status === 404) {
            Helpers.storeResult(false, false, {reqId: "10.1.0.0-1", msg: "Document request returned 404 Not Found."});
            return;
        }
        else {
            launchDataContent = await launchDataResponse.text();
            Helpers.storeResult(false, false, {reqId: "4.2.0.0-2", msg: `State request status code: ${launchDataResponse.status} ${launchDataContent}`});
            return;
        }

        if (typeof launchDataContent.contextTemplate === "undefined") {
            Helpers.storeResult(false, false, {reqId: "10.2.1.0-1", msg: "\"contextTemplate\" missing from LMS.LaunchData"});
            return;
        }
        if (typeof launchDataContent.contextTemplate.extensions === "undefined" || typeof launchDataContent.contextTemplate.extensions["https://w3id.org/xapi/cmi5/context/extensions/sessionid"] === "undefined" || ! launchDataContent.contextTemplate.extensions["https://w3id.org/xapi/cmi5/context/extensions/sessionid"]) {
            Helpers.storeResult(false, false, {reqId: "10.2.1.0-2", msg: "sessionid extension missing from LMS.LaunchData contextTemplate"});
            return;
        }
        if (typeof launchDataContent.contextTemplate.contextActivities === "undefined" || launchDataContent.contextTemplate.contextActivities.grouping === "undefined" || ! launchDataContent.contextTemplate.contextActivities.grouping.some((a) => a.id === "https://w3id.org/xapi/cmi5/catapult/lts/au/001-essentials")) {
            Helpers.storeResult(false, false, {reqId: "10.2.1.0-3", msg: "AU publisher id 'https://w3id.org/xapi/cmi5/catapult/lts/au/001-essentials' missing from LMS.LaunchData contextTemplate.contextActivities.grouping"});
            return;
        }

        if (typeof launchDataContent.launchMode === "undefined") {
            Helpers.storeResult(false, false, {reqId: "10.2.2.0-4", msg: "\"launchMode\" missing from LMS.LaunchData"});
            return;
        }
        if (typeof launchDataContent.launchParameters === "undefined") {
            Helpers.storeResult(false, false, {reqId: "10.2.3.0-1", msg: "\"launchParameters\" missing from LMS.LaunchData"});
            return;
        }
        if (typeof launchDataContent.masteryScore === "undefined") {
            Helpers.storeResult(false, false, {reqId: "10.2.4.0-1", msg: "\"masteryScore\" missing from LMS.LaunchData"});
            return;
        }
        // eslint-disable-next-line no-magic-numbers
        if (launchDataContent.masteryScore !== 0.9) {
            Helpers.storeResult(false, false, {reqId: "10.2.4.0-1", msg: `"masteryScore" (${launchDataContent.masteryScore}) does not match original configuration (0.9)`});
            return;
        }
        if (typeof launchDataContent.moveOn === "undefined") {
            Helpers.storeResult(false, false, {reqId: "10.2.5.0-1", msg: "\"moveOn\" missing from LMS.LaunchData"});
            return;
        }
        if (launchDataContent.moveOn !== "CompletedAndPassed") {
            // this needs to be CompletedAndPassed so that the order of the received statements works with the satisfied checks
            Helpers.storeResult(false, false, {msg: `Unexpected moveOn "${launchDataContent.moveOn}", expected: CompletedAndPassed`});
            return;
        }

        if (typeof launchDataContent.entitlementKey === "undefined" || typeof launchDataContent.entitlementKey.courseStructure === "undefined") {
            Helpers.storeResult(false, false, {reqId: "10.2.7.0-1", msg: "\"entitlementKey\" missing from LMS.LaunchData"});
            return;
        }
        if (launchDataContent.entitlementKey.courseStructure !== "sample value") {
            Helpers.storeResult(false, false, {reqId: "10.2.7.1-1", msg: "\"entitlementKey\" missing from LMS.LaunchData"});
            return;
        }

        let learnerPrefsResponse;

        try {
            learnerPrefsResponse = await fetch(
                `${endpoint}/agents/profile?` + new URLSearchParams(
                    {
                        profileId: "cmi5LearnerPreferences",
                        agent: actor
                    }
                ),
                {
                    method: "GET",
                    mode: "cors",
                    headers: {
                        "X-Experience-API-Version": "1.0.3",
                        Authorization: authHeader
                    }
                }
            );
        }
        catch (ex) {
            Helpers.storeResult(false, true, {msg: `Failed request to get cmi5LearnerPreferences document: ${ex}`});
            return;
        }

        if (learnerPrefsResponse.status === 200) {
            let learnerPrefsContent;

            try {
                learnerPrefsContent = await learnerPrefsResponse.json();
            }
            catch (ex) {
                Helpers.storeResult(false, false, {reqId: "11.0.0.0-5", msg: `Body parse fail: ${ex}`});
                return;
            }

            if (typeof learnerPrefsContent.languagePreference === "undefined") {
                Helpers.storeResult(false, false, {reqId: "11.0.0.0-5", msg: "\"languagePreference\" missing"});
                return;
            }
            else if (typeof learnerPrefsContent.audioPreference === "undefined") {
                Helpers.storeResult(false, false, {reqId: "11.0.0.0-5", msg: "\"audioPreference\" missing"});
                return;
            }
        }
        else if (learnerPrefsResponse.status === 404) {
            // not found is acceptable, just means LMS didn't write the document
        }
        else {
            Helpers.storeResult(false, false, {reqId: "4.2.0.0-2", msg: `Agent profile request status code: ${learnerPrefsResponse.status}`});
            return;
        }

        try {
            const id = Cmi5.uuidv4(),
                statement = {
                    id,
                    timestamp: new Date().toISOString(),
                    actor: actorObj,
                    verb: {
                        id: "http://adlnet.gov/expapi/verbs/initialized",
                        display: {
                            en: "initialized"
                        }
                    },
                    object: {
                        id: activityId
                    },
                    context: JSON.parse(JSON.stringify(launchDataContent.contextTemplate))
                };

            statement.context.registration = registration;
            statement.context.contextActivities.category = statement.context.contextActivities.category || [];
            statement.context.contextActivities.category.push(
                {
                    id: "https://w3id.org/xapi/cmi5/context/categories/cmi5"
                }
            );

            const initializedStResponse = await fetch(
                `${endpoint}/statements?` + new URLSearchParams(
                    {
                        statementId: id
                    }
                ),
                {
                    method: "PUT",
                    mode: "cors",
                    headers: {
                        "X-Experience-API-Version": "1.0.3",
                        Authorization: authHeader,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(statement)
                }
            );

            if (initializedStResponse.status !== 204) {
                const initializedStContent = await initializedStResponse.text();

                Helpers.storeResult(false, false, {reqId: "4.2.0.0-2", msg: `Initialized statement request status code: ${initializedStResponse.status} ${initializedStContent}`});
                return;
            }
        }
        catch (ex) {
            Helpers.storeResult(false, true, {msg: `Failed request to store initialized statement: ${ex}`});
            return;
        }

        try {
            const id = Cmi5.uuidv4(),
                statement = {
                    id,
                    timestamp: new Date().toISOString(),
                    actor: actorObj,
                    verb: {
                        id: "http://adlnet.gov/expapi/verbs/passed",
                        display: {
                            en: "passed"
                        }
                    },
                    object: {
                        id: activityId
                    },
                    result: {
                        success: true,
                        duration: "PT1S"
                    },
                    context: JSON.parse(JSON.stringify(launchDataContent.contextTemplate))
                };

            statement.context.registration = registration;
            statement.context.contextActivities.category = statement.context.contextActivities.category || [];
            statement.context.contextActivities.category.push(
                {
                    id: "https://w3id.org/xapi/cmi5/context/categories/cmi5"
                },
                {
                    id: "https://w3id.org/xapi/cmi5/context/categories/moveon"
                }
            );

            const passedStResponse = await fetch(
                `${endpoint}/statements?` + new URLSearchParams(
                    {
                        statementId: id
                    }
                ),
                {
                    method: "PUT",
                    mode: "cors",
                    headers: {
                        "X-Experience-API-Version": "1.0.3",
                        Authorization: authHeader,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(statement)
                }
            );

            if (passedStResponse.status !== 204) {
                const passedStContent = await passedStResponse.text();

                Helpers.storeResult(false, false, {reqId: "4.2.0.0-2", msg: `Terminated statement request status code: ${passedStResponse.status} ${passedStContent}`});
                return;
            }
        }
        catch (ex) {
            Helpers.storeResult(false, true, {msg: `Failed request to store passed statement: ${ex}`});
            return;
        }

        try {
            const id = Cmi5.uuidv4(),
                statement = {
                    id,
                    timestamp: new Date().toISOString(),
                    actor: actorObj,
                    verb: {
                        id: "http://adlnet.gov/expapi/verbs/completed",
                        display: {
                            en: "completed"
                        }
                    },
                    object: {
                        id: activityId
                    },
                    result: {
                        completion: true,
                        duration: "PT1S"
                    },
                    context: JSON.parse(JSON.stringify(launchDataContent.contextTemplate))
                };

            statement.context.registration = registration;
            statement.context.contextActivities.category = statement.context.contextActivities.category || [];
            statement.context.contextActivities.category.push(
                {
                    id: "https://w3id.org/xapi/cmi5/context/categories/cmi5"
                },
                {
                    id: "https://w3id.org/xapi/cmi5/context/categories/moveon"
                }
            );

            const completedStResponse = await fetch(
                `${endpoint}/statements?` + new URLSearchParams(
                    {
                        statementId: id
                    }
                ),
                {
                    method: "PUT",
                    mode: "cors",
                    headers: {
                        "X-Experience-API-Version": "1.0.3",
                        Authorization: authHeader,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(statement)
                }
            );

            if (completedStResponse.status !== 204) {
                const completedStContent = await completedStResponse.text();

                Helpers.storeResult(false, false, {reqId: "4.2.0.0-2", msg: `Terminated statement request status code: ${completedStResponse.status} ${completedStContent}`});
                return;
            }
        }
        catch (ex) {
            Helpers.storeResult(false, true, {msg: `Failed request to store completed statement: ${ex}`});
            return;
        }

        try {
            const id = Cmi5.uuidv4(),
                statement = {
                    id,
                    timestamp: new Date().toISOString(),
                    actor: actorObj,
                    verb: {
                        id: "http://adlnet.gov/expapi/verbs/terminated",
                        display: {
                            en: "terminated"
                        }
                    },
                    object: {
                        id: activityId
                    },
                    result: {
                        duration: "PT15S"
                    },
                    context: JSON.parse(JSON.stringify(launchDataContent.contextTemplate))
                };

            statement.context.registration = registration;
            statement.context.contextActivities.category = statement.context.contextActivities.category || [];
            statement.context.contextActivities.category.push(
                {
                    id: "https://w3id.org/xapi/cmi5/context/categories/cmi5"
                }
            );

            const terminatedStResponse = await fetch(
                `${endpoint}/statements?` + new URLSearchParams(
                    {
                        statementId: id
                    }
                ),
                {
                    method: "PUT",
                    mode: "cors",
                    headers: {
                        "X-Experience-API-Version": "1.0.3",
                        Authorization: authHeader,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(statement)
                }
            );

            if (terminatedStResponse.status !== 204) {
                const terminatedStContent = await terminatedStResponse.text();

                Helpers.storeResult(false, false, {reqId: "4.2.0.0-2", msg: `Terminated statement request status code: ${terminatedStResponse.status} ${terminatedStContent}`});
                return;
            }
        }
        catch (ex) {
            Helpers.storeResult(false, true, {msg: `Failed request to store terminated statement: ${ex}`});
            return;
        }

        if (launchDataContent.returnURL) {
            window.document.location.href = launchDataContent.returnURL;
        }

        Helpers.storeResult(
            true,
            false,
            {
                registration,
                sessionId: launchDataContent.contextTemplate.extensions["https://w3id.org/xapi/cmi5/context/extensions/sessionid"],
                launchMode: launchDataContent.launchMode,
                masteryScore: launchDataContent.masteryScore,
                moveOn: launchDataContent.moveOn,
                launchParameters: launchDataContent.launchParameters,
                launchString
            }
        );
    }
    catch (ex) {
        Helpers.storeResult(false, true, {msg: `Failed to execute: ${ex}`});
    }
};
/* eslint-enable padding-line-between-statements */

execute();
