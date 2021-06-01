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
    CMI5_DEFINED_ID = "https://w3id.org/xapi/cmi5/context/categories/cmi5",

    VERB_INITIALIZED_ID = "http://adlnet.gov/expapi/verbs/initialized",
    VERB_TERMINATED_ID = "http://adlnet.gov/expapi/verbs/terminated",
    VERB_COMPLETED_ID = "http://adlnet.gov/expapi/verbs/completed",
    VERB_PASSED_ID = "http://adlnet.gov/expapi/verbs/passed",
    VERB_FAILED_ID = "http://adlnet.gov/expapi/verbs/failed",

    beforeLRSRequest = (req, h) => {
        let method = req.method;

        if (method === "post" && typeof req.query.method !== "undefined") {
            method = req.query.method;

            throw new Error(`Alternate method request syntax not implemented: ${method} to ${req.query.method}`);
        }

        const resource = req.params.resource;

        if (resource === "statements") {
            const statements = Array.isArray(req.payload) ? req.payload : [req.payload];

            for (const st of statements) {
                // all statements have to have the actor, the context based on the template,
                // timestamp, id, etc.
                if (typeof st.id === "undefined") {
                    throw Boom.unauthorized(new Error("9.1.0.0-1 - The AU MUST assign a statement id property in UUID format (as defined in the xAPI specification) for all statements it issues."));
                }

                // throw Boom.unauthorized(new Error(` (${st.id})`));

                const timestampDate = new Date(st.timestamp);

                if (timestampDate.getTimezoneOffset() !== 0) {
                    throw Boom.unauthorized(new Error(`9.7.0.0-2 - All timestamps MUST be recorded in UTC time. (${st.id})`));
                }

                if (! st.context || ! st.context.contextActivities) {
                    throw Boom.unauthorized(new Error(`10.2.1.0-6 - The AU MUST use the contextTemplate as a template for the "context" property in all xAPI statements it sends to the LMS. (${st.id})`));
                }
                if (! st.context.registration) {
                    throw Boom.unauthorized(new Error(` (${st.id})`));
                }

                if (st.context.contextActivities
                    && st.context.contextActivities.category
                    && Array.isArray(st.context.contextActivities.category)
                    && st.context.contextActivities.category.some((element) => element.id === CMI5_DEFINED_ID)
                ) {
                    //
                    // undefined actor.objectType implies Agent
                    //
                    if (typeof st.actor === "undefined" || (typeof st.actor.objectType !== "undefined" && st.actor.objectType !== "Agent")) {
                        throw Boom.unauthorized(new Error(`9.2.0.0-2 - The Actor property for all "cmi5 defined" statements MUST be of objectType "Agent". (${st.id})`));
                    }

                    if (typeof st.actor.account === "undefined" || typeof st.actor.account.name === "undefined" || typeof st.actor.account.homePage === "undefined") {
                        throw Boom.unauthorized(new Error(`9.2.0.0-3 - The Actor property MUST contain an "account" IFI as defined in the xAPI specification. (${st.id})`));
                    }

                    const verbId = st.verb.id;

                    switch (verbId) {
                        case VERB_INITIALIZED_ID:
                            console.log(VERB_INITIALIZED_ID);
                            break;

                        case VERB_TERMINATED_ID:
                            console.log(VERB_TERMINATED_ID);
                            break;

                        case VERB_COMPLETED_ID:
                            console.log(VERB_COMPLETED_ID);
                            break;

                        case VERB_PASSED_ID:
                            console.log(VERB_PASSED_ID);
                            break;

                        case VERB_FAILED_ID:
                            console.log(VERB_FAILED_ID);
                            break;

                        default:
                            throw Boom.unauthorized(new Error(`9.3.0.0-1 - AUs MUST use the below verbs that are indicated as mandatory in other sections of this specification. (Unrecognized cmi5 defined statement: ${verbId} - ${st.id})`));
                    }
                }
                else {
                    console.log("cmi5 allowed statement", st);
                }
            }
        }
        else if (resource === "activities/state") {
            if (req.query.stateId === "LMS.LaunchData" && method !== "get") {
                throw Boom.unauthorized(new Error(`10.2.1.0-5 - The AU MUST NOT modify or delete the "LMS.LaunchData" State document. (${method}`));
            }
        }
        else if (resource === "agents/profile") {
            if (req.query.profileId === "cmi5LearnerPreferences") {
                if (method === "delete") {
                    throw Boom.unauthorized(new Error("Rejected request to delete the learner preferences Agent Profile document"));
                }
                else if (method === "put" || method === "post") {
                    throw Boom.unauthorized(new Error("Rejected request to alter the learner preferences Agent Profile document"));
                }
            }
        }
    },
    afterLRSRequest = (res, req, h) => {
        const method = req.method,
            resource = req.params.resource,
            status = res.statusCode;

        if (resource === "statements") {
            if (method === "post" && status === 200) {
            }
            else if (method === "put" && status === 204) {
            }
        }
        else if (resource === "activities/state" && status === 200 && method === "get" && req.query.profileId === "LMS.LaunchData") {
        }
        else if (resource === "agents/profile" && status === 200 && method === "get" && req.query.profileId === "cmi5LearnerPreferences") {
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
