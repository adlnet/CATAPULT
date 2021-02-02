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

const Wreck = require("@hapi/wreck");

module.exports = {
    name: "catapult-player-api-routes-lrs",
    register: (server, options) => {
        server.route(
            {
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
                                // TODO: handle internal errors
                                console.log(`h2o2.onResponse - err: ${err}`);
                                throw new Error(err);
                            }

                            console.log(`h2o2.onResponse - statusCode: ${res.statusCode}, statusMessage: '${res.statusMessage}', httpVersion: ${res.httpVersion}`);
                            console.log("h2o2.onResponse - headers:", res.headers);

                            const payload = await Wreck.read(res),
                                response = h.response(payload);

                            response.code(res.statusCode);
                            response.message(res.statusMessage);

                            for (const [k, v] of Object.entries(res.headers)) {
                                if (k.toLowerCase() !== "transfer-encoding") {
                                    response.header(k, v);
                                }
                            }


                            // clean up the original response
                            res.destroy();

                            if (res.statusCode !== 204 && res.statusCode !== 200) {
                                console.log("h2o2.onRequest", payload.toString());
                            }

                            return response;
                        }
                    }
                }
            }
        );
    }
};
