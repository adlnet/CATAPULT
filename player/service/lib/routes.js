/*
Copyright 2020 Rustici Software

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

const Path = require("path"),
    Wreck = require("@hapi/wreck"),
    { v4: uuidv4 } = require("uuid");

module.exports = [
    {
        method: "POST",
        path: "/fetch-url",
        handler: (req, h) => ({
            "auth-token": "ZGV2LXRvb2xzLXhhcGk6ZGV2LXRvb2xzLXhhcGktcGFzc3dvcmQ="
        })
    },

    //
    // proxy the underlying LRS resources
    //
    {
        // method: "*",
        method: [
            "GET",
            "POST",
            "PUT",
            "DELETE",
            "OPTIONS"
        ],
        path: "/lrs/{resource*}",
        options: {
            //
            // turn off CORS for this handler because the LRS will provide back the right headers
            // this just needs to pass them through, enabling CORS for this route means they get
            // overwritten by the Hapi handling
            //
            cors: false,

            //
            // set up a pre-request handler to handle any cmi5 requirements validation before
            // proxying the request to the underlying LRS
            //
            pre: [
                (req, h) => {
                    console.log("lrs.pre", req.method, req.params.resource);
                    return null;
                }
            ]
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
                }),

                //
                // hook into the response provided back from the LRS to capture details such as
                // the status code, error messages, etc.
                //
                onResponse: async (err, res, req, h, settings) => {
                    console.log(`h2o2.onResponse - request: ${req.method} ${req.params.resource}`);

                    if (err !== null) {
                        console.log(`h2o2.onResponse - err: ${err}`);
                        throw new Error(err);
                    }

                    console.log(`h2o2.onResponse - statusCode: ${res.statusCode}, statusMessage: '${res.statusMessage}', httpVersion: ${res.httpVersion}`);
                    console.log("h2o2.onResponse - headers:", res.headers);

                    const payload = await Wreck.read(res),
                        response = h.response(payload);

                    response.code(res.statusCode);
                    response.message(res.statusMessage);
                    response.headers = res.headers;

                    // clean up the original response
                    res.destroy();

                    if (res.statusCode !== 204 && res.statusCode !== 200) {
                        console.log("h2o2.onRequest", payload.toString());
                    }

                    return response;
                }
            }
        }
    },

    //
    // serve the locally stored content files
    //
    {
        method: "GET",
        path: "/content/{param*}",
        handler: {
            directory: {
                path: `${__dirname}/../var/content`
            }
        }
    },

    {
        method: "GET",
        path: "/api/ping",
        handler: (req, h) => ({
            ok: true
        })
    },

    {
        method: "POST",
        path: "/api/content",
        handler: (req, h) => {
        }
    },

    {
        method: "GET",
        path: "/api/course-structure",
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
        method: "GET",
        path: "/api/launch-url",
        handler: async (req, h) => {
            console.log("get launchUrl");

            const actor = {
                    account: {
                        homePage: `${req.url.protocol}//${req.url.host}`,
                        name: "brian.miller"
                    }
                },
                registration = uuidv4(),
                lmsActivityId = "http://lms.catapult",

                returnURL = `${base}/return-url`;

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
];
