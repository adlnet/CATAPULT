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

const Helpers = {
    storeResult: (success, isError, addtl = {}) => {
        const resultElement = document.createElement("pre");

        resultElement.id = "result";

        resultElement.innerHTML = JSON.stringify(
            {
                success,
                isError,
                ...addtl
            },
            null,
            4 // eslint-disable-line no-magic-numbers
        );

        document.body.appendChild(resultElement);
    },
    initCmi5: () => {
        let cmi5;

        try {
            cmi5 = new Cmi5(window.document.location.href);
        }
        catch (ex) {
            Helpers.storeResult(false, true, {msg: `Failed to construct Cmi5 object: ${ex}`});

            return;
        }

        return cmi5;
    },
    initAU: async () => {
        let cmi5;

        try {
            cmi5 = Helpers.initCmi5();
            if (! cmi5) {
                return;
            }

            await cmi5.start();
        }
        catch (ex) {
            Helpers.storeResult(false, true, {msg: `Failed to initialize AU: ${ex}`});

            return;
        }

        return cmi5;
    },
    closeAU: async (cmi5, loadReturnURL = false) => {
        try {
            await cmi5.terminate();
        }
        catch (ex) {
            Helpers.storeResult(false, true, {msg: `Failed to terminate AU: ${ex}`});

            return;
        }

        try {
            const returnURL = cmi5.getReturnURL();

            if (returnURL !== null) {
                if (! loadReturnURL) {
                    const returnUrlBtn = document.createElement("button");

                    returnUrlBtn.id = "returnURL";
                    returnUrlBtn.innerHTML = "Click to load LMS returnURL";

                    returnUrlBtn.addEventListener(
                        "click",
                        () => {
                            window.document.location.href = returnURL;
                        }
                    );

                    document.body.appendChild(returnUrlBtn);
                }
                else {
                    window.document.location.href = returnURL;
                }
            }
        }
        catch (ex) {
            Helpers.storeResult(false, true, {msg: `Failed to handle returnURL: ${ex}`});
        }
    },
    sendStatement: async (cmi5, st, reqId, cfg = {}) => {
        try {
            const endpoint = cmi5.getEndpoint();
            let url = `${endpoint}/statements`;

            if (cfg.method !== "post") {
                url += "?" + new URLSearchParams(
                    {
                        statementId: st.id
                    }
                );
            }

            const authHeader = cmi5.getAuth(),
                stResponse = await fetch(
                    url,
                    {
                        method: cfg.method || "PUT",
                        mode: "cors",
                        headers: {
                            "X-Experience-API-Version": "1.0.3",
                            Authorization: authHeader,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(st)
                    }
                ),
                stContent = await stResponse.text();

            if (cfg.shouldSucceed) {
                if (stResponse.status === 204 || stResponse.status === 200) {
                    return true;
                }

                Helpers.storeResult(false, false, {reqId: "4.2.0.0-2", msg: `Statement should have succeeded, response status code: ${stResponse.status} ${stContent} (Testing ${reqId})`});

                return false;
            }

            if (cfg.debug) {
                console.log(reqId, stContent);
            }

            // If we provide an explicit set of statuses to match, exclude fallthrough cases.
            if (cfg.expectedStatuses) {
                if (cfg.expectedStatuses.indexOf(stResponse.status) > -1) {
                    return true;
                }

                Helpers.storeResult(false, false, {reqId, msg: `Statement should have been rejected with a status code of (one of) ${cfg.expectedStatuses}, received response status code: ${stResponse.status} ${stContent} (Testing ${reqId})`});

                return false;
            }

            if (stResponse.status === 204 || stResponse.status === 200) {
                Helpers.storeResult(false, false, {reqId, msg: `Statement not rejected (${stResponse.status})`});

                return false;
            }
            // treats specific tests for unauthorized requests as acceptable responses.
            // eslint-disable-next-line no-magic-numbers
            else if (stResponse.status === 401 && cfg.acceptUnauthorized) {
                return true;
            }
            // this treats non-403 (like 400, 500, etc.) as not acceptable responses
            // for denying the statement
            // eslint-disable-next-line no-magic-numbers
            else if (stResponse.status !== 403) {
                Helpers.storeResult(false, false, {reqId: "4.2.0.0-2", msg: `Statement request status code: ${stResponse.status} ${stContent} (Testing ${reqId})`});

                return false;
            }
        }
        catch (ex) {
            // request should succeed so an exception here is an error
            Helpers.storeResult(false, true, {reqId, msg: `Failed request to store statement: ${ex}`});

            return false;
        }

        return true;
    },
    stateRequest: async (cmi5, method, stateId, body) => {
        try {
            const requestCfg = {
                method,
                mode: "cors",
                headers: {
                    "X-Experience-API-Version": "1.0.3",
                    Authorization: cmi5.getAuth()
                }
            };

            if (body) {
                requestCfg.headers["Content-Type"] = "application/json";
                requestCfg.body = body;
            }

            const response = await fetch(
                    `${cmi5.getEndpoint()}/activities/state?` + new URLSearchParams(
                        {
                            agent: JSON.stringify(cmi5.getActor()),
                            activityId: cmi5.getActivityId(),
                            registration: cmi5.getRegistration(),
                            stateId
                        }
                    ),
                    requestCfg
                ),
                responseContent = await response.text();

            // expect the first request to be not found because it hasn't been written yet
            if (response.status === 404 && method === "get") {
                return;
            }

            if (response.status !== 200 && response.status !== 204) {
                Helpers.storeResult(false, true, {msg: `State request failed (${response.status}): ${responseContent}`});

                return false;
            }

            if (method === "get") {
                return responseContent;
            }
        }
        catch (ex) {
            Helpers.storeResult(false, true, {msg: `Failed request to State API: ${ex}`});

            return false;
        }

        return true;
    }
};

export default Helpers;
