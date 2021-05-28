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
    beforeLRSRequest = (req, h) => {
        let method = req.method;

        if (method === "post" && typeof req.query.method !== "undefined") {
            method = req.query.method;
        }

        const resource = req.params.resource;

        if (resource === "statements") {
        }
        else if (resource === "activities/state") {
            if (req.query.stateId === "LMS.LaunchData") {
                if (req.method === "delete") {
                    throw Boom.unauthorized(new Error(`10.2.1.0-5 - The AU MUST NOT modify or delete the "LMS.LaunchData" State document.`));
                }
                else if (req.method === "get") {
                }
                else {
                }
            }
        }
        else if (resource === "agents/profile") {
            if (req.query.profileId === "LMS.LaunchData") {
                if (req.method === "delete") {
                }
                else if (req.method === "get") {
                }
                else {
                }
            }
        }
    },
    afterLRSRequest = (res, req, h) => {
        const method = req.method,
            resource = req.params.resource;

        if (req.params.resource === "statements") {
            if (req.method === "post" && res.statusCode === 200) {
            }
            else if (req.method === "put" && res.statusCode === 204) {
            }
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
                    beforeLRSRequest(req, h);

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
                        payload = await Wreck.read(res),
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

                    afterLRSRequest(res, req, h);

                    return response;
                }
            }
        );
    }
};
