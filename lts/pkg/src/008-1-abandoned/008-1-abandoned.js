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

const execute = async () => {
    const cmi5 = await Helpers.initAU();

    if (! cmi5) {
        return;
    }

    //
    // this AU runs to set up the session and then to have the session abandoned
    // it will indicate the time to do the abandonment by adding a button to the
    // DOM that should then get used to indicate that the session has been abandoned
    // at which point it will attempt to do some more requests which should get
    // denied because the session has been abandoned
    //
    const abandonBtn = document.createElement("button");

    abandonBtn.id = "abandon";
    abandonBtn.innerHTML = "Click when session has been abandoned";
    abandonBtn.setAttribute("value", cmi5.getSessionId());

    abandonBtn.addEventListener(
        "click",
        async () => {
            abandonBtn.remove();

            //
            // send statement after abandoned - should be rejected because the
            // session is already abandoned, but is more likely to be rejected
            // because the credential is no longer acceptable, the specific
            // reason isn't the relevant point
            //
            // Also validates: 9.3.0.0-2 (d), 8.2.1.0-6
            //
            const allowedSt = cmi5.prepareStatement("http://adlnet.gov/expapi/verbs/experienced");

            if (! await Helpers.sendStatement(cmi5, allowedSt, "9.3.6.0-2 (d2)",
                {expectedStatuses: [401, 403]})) {
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

            Helpers.storeResult(
                true,
                false,
                {
                    session: cmi5.getSessionId(),
                    registration: cmi5.getRegistration(),
                    actor: cmi5.getActor(),
                    activityId: cmi5.getActivityId(),
                    msg: "completed successfully"
                }
            );
        }
    );

    document.body.appendChild(abandonBtn);
};

execute();
