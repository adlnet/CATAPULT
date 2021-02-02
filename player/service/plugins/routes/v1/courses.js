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

const { v4: uuidv4 } = require("uuid");

module.exports = {
    name: "catapult-player-api-routes-v1-courses",
    register: (server, options) => {
        server.route(
            {
                method: "GET",
                path: "/course/{courseId}",
                handler: (req, h) => ({
                    course: {
                        id: "http://example.org...",
                        au: [
                            {
                                id: "http://example.org..."
                            }
                        ]
                    }
                })
            },

            {
                method: "POST",
                path: "/course/{courseId}",
                handler: (req, h) => {
                    // TODO: import course structure, zip
                }
            },

            {
                method: "DELETE",
                path: "/course/{courseId}",
                handler: (req, h) => {
                    // TODO: delete course
                }
            },

            {
                method: "GET",
                path: "/course/{courseId}/launch-url/{auIndex}",
                handler: async (req, h) => {
                    console.log("get launchUrl");

                    // TODO: needs to receive actor, registration, and activity ID of LMS id for AU
                    //       (which should be available from course structure endpoint above)
                    //
                    //       should `actor` really be something like `accountName` which is then
                    //       used to construct an account based on a pre-configured `homePage`?
                    //       or both?
                    const actor = {
                            account: {
                                homePage: `${req.url.protocol}//${req.url.host}`,
                                name: "brian.miller"
                            }
                        },
                        registration = uuidv4(),
                        lmsActivityId = "http://lms.catapult",

                        // TODO: need to pass this in?
                        returnURL = `${base}/return-url`;

                    // TODO: need to look up based on lmsActivityId + registration?
                    const publisherActivityId = "http://publisher.catapult",
                        launchMode = "Normal",
                        launchMethod = "AnyWindow",
                        moveOn = "Completed",
                        contentPath = "cmi5-au-sim/index.html",
                        contentUrl = `${req.url.protocol}//${req.url.host}/content/${contentPath}`;

                    const base = `${req.url.protocol}//${req.url.host}`,
                        endpoint = `${base}/lrs`,
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

                    console.log("setting LMS.LaunchData");
                    try {
                        const lmsLaunchDataStateParams = new URLSearchParams(
                                {
                                    stateId: "LMS.LaunchData",
                                    agent: JSON.stringify(actor),
                                    activityId: lmsActivityId,
                                    registration
                                }
                            ),
                            lmsLaunchDataRes = await lrsWreck.post(
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

                        console.log("set LMS.LaunchData", lmsLaunchDataRes.res.statusCode);
                    }
                    catch (ex) {
                        console.log("Failed to set LMS.LaunchData state document", ex);
                        throw ex;
                    }

                    // TODO: store learner preferences? based on what?

                    try {
                        const launchedStContext = {
                            ...contextTemplate,
                            registration,
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

                        const launchedStRes = await lrsWreck.post(
                            "statements",
                            {
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                payload: {
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

                        console.log("stored launched statement", launchedStRes.res.statusCode);
                    }
                    catch (ex) {
                        console.log("Failed to store launched statement", ex.data.payload.toString());
                        console.log(ex);
                        throw ex;
                    }

                    const launchUrlParams = new URLSearchParams(
                        {
                            endpoint,
                            fetch: `${base}/fetch-url`,
                            actor: JSON.stringify(actor),
                            activityId: lmsActivityId,
                            registration
                        }
                    );

                    return h.redirect(`${contentUrl}?${launchUrlParams.toString()}`);
                }
            }
        );
    }
};
