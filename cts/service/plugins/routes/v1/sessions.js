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

const stream = require("stream"),
    Boom = require("@hapi/boom"),
    Wreck = require("@hapi/wreck"),
    Hoek = require("@hapi/hoek"),
    Joi = require("joi"),
    { v4: uuidv4 } = require("uuid"),
    Requirements = require("@cmi5/requirements"),
    sessions = {},
    getClientSafeSession = (session) => {
        delete session.playerId;
        delete session.playerAuLaunchUrl;
        delete session.playerEndpoint;
        delete session.playerFetch;

        return session;
    };

module.exports = {
    name: "catapult-cts-api-routes-v1-sessions",
    register: (server, options) => {
        server.decorate(
            "toolkit",
            "sessionEvent",
            async (sessionId, tenantId, db, rawData) => {
                const metadata = {
                        version: 1,
                        ...rawData
                    },
                    log = {
                        tenantId,
                        sessionId,
                        metadata: JSON.stringify(metadata)
                    };

                try {
                    const insertResult = await db.insert(log).into("sessions_logs");

                    log.id = insertResult[0];
                }
                catch (ex) {
                    console.log(`Failed to write to sessions_logs(${sessionId}): ${ex}`);
                }

                log.metadata = metadata;

                if (sessions[sessionId]) {
                    sessions[sessionId].write(JSON.stringify(log) + "\n");
                }
            }
        );

        server.route(
            [
                //
                // not proxying this request because have to alter the body based on
                // converting the CTS course id to the stored Player course id
                //
                {
                    method: "POST",
                    path: "/sessions",
                    options: {
                        tags: ["api"],
                        validate: {
                            payload: Joi.object({
                                testId: Joi.number().integer().min(0).required(),
                                auIndex: Joi.number().integer().min(0).required(),
                                alternateEntitlementKey: Joi.string().optional(),
                                launchMode: Joi.any().allow("Normal", "Browse", "Review").optional(),
                                launchMethod: Joi.any().allow("iframe", "newWindow").optional(),
                                contextTemplateAdditions: Joi.object().optional(),
                                launchParameters: Joi.string().optional(),
                                masteryScore: Joi.number().positive().min(0).max(1).optional(),
                                moveOn: Joi.any().allow("Passed", "Completed", "CompletedAndPassed", "CompletedOrPassed", "NotApplicable").optional()
                            }).required().label("Request-PostSession")
                        }
                    },
                    handler: async (req, h) => {
                        const db = req.server.app.db,
                            tenantId = req.auth.credentials.tenantId,
                            testId = req.payload.testId,
                            auIndex = req.payload.auIndex,
                            baseUrl = (req.headers["x-forwarded-proto"] ? `${req.headers["x-forwarded-proto"]}:` : req.url.protocol) + `//${req.info.host}`;

                        let queryResult;

                        try {
                            queryResult = await db
                                .first("*")
                                .queryContext({jsonCols: ["registrations.metadata", "courses.metadata"]})
                                .from("registrations")
                                .leftJoin("courses", "registrations.course_id", "courses.id")
                                .where({"registrations.tenantId": tenantId, "registrations.id": testId})
                                .options({nestTables: true});
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed to retrieve registration for id ${testId}: ${ex}`));
                        }

                        if (! queryResult) {
                            throw Boom.notFound(`registration: ${testId}`);
                        }

                        let createResponse,
                            createResponseBody;

                        try {
                            createResponse = await Wreck.request(
                                "POST",
                                `${req.server.app.player.baseUrl}/api/v1/course/${queryResult.courses.player_id}/launch-url/${auIndex}`,
                                {
                                    headers: {
                                        Authorization: await req.server.methods.playerBearerAuthHeader(req)
                                    },
                                    payload: {
                                        actor: queryResult.registrations.metadata.actor,
                                        reg: queryResult.registrations.code,
                                        contextTemplateAdditions: req.payload.contextTemplateAdditions,
                                        launchMode: req.payload.launchMode,
                                        launchParameters: req.payload.launchParameters,
                                        masteryScore: req.payload.masteryScore,
                                        moveOn: req.payload.moveOn,
                                        alternateEntitlementKey: req.payload.alternateEntitlementKey,
                                        returnUrl: `${baseUrl}/api/v1/sessions/__sessionId__/return-url`
                                    }
                                }
                            );
                            createResponseBody = await Wreck.read(createResponse, {json: true});
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed to request AU launch url from player: ${ex}`));
                        }

                        if (createResponse.statusCode !== 200) {
                            throw Boom.internal(new Error(`Failed to retrieve AU launch URL from player (${createResponse.statusCode}): ${createResponseBody.message}${createResponseBody.srcError ? " (" + createResponseBody.srcError + ")" : ""}`));
                        }

                        const playerAuLaunchUrl = createResponseBody.url,
                            playerAuLaunchUrlParsed = new URL(playerAuLaunchUrl),
                            playerEndpoint = playerAuLaunchUrlParsed.searchParams.get("endpoint"),
                            playerFetch = playerAuLaunchUrlParsed.searchParams.get("fetch");
                        let sessionId;

                        try {
                            const sessionInsert = await db.insert(
                                {
                                    tenant_id: tenantId,
                                    player_id: createResponseBody.id,
                                    registration_id: testId,
                                    au_index: auIndex,
                                    player_au_launch_url: playerAuLaunchUrl,
                                    player_endpoint: playerEndpoint,
                                    player_fetch: playerFetch,
                                    metadata: JSON.stringify(
                                        {
                                            version: 1,
                                            launchMethod: createResponseBody.launchMethod,
                                            violatedReqIds: []
                                        }
                                    )
                                }
                            ).into("sessions");

                            sessionId = sessionInsert[0];
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed to insert into sessions: ${ex}`));
                        }

                        const auTitle = queryResult.courses.metadata.aus[auIndex].title[0].text;

                        await h.registrationEvent(testId, tenantId, db, {kind: "api", resource: "sessions:create", sessionId, auIndex, summary: `Launched AU: ${auTitle}`});
                        await h.sessionEvent(sessionId, tenantId, db, {kind: "api", resource: "create", summary: `AU ${auTitle} session initiated`});

                        //
                        // swap endpoint, fetch for proxied versions
                        //
                        playerAuLaunchUrlParsed.searchParams.set("endpoint", `${baseUrl}/api/v1/sessions/${sessionId}/lrs`);
                        playerAuLaunchUrlParsed.searchParams.set("fetch", `${baseUrl}/api/v1/sessions/${sessionId}/fetch`);

                        const ctsLaunchUrl = playerAuLaunchUrlParsed.href;
                        const result = await db.first("*").from("sessions").queryContext({jsonCols: ["metadata"]}).where({tenantId, id: sessionId});

                        result.launchUrl = ctsLaunchUrl;
                        result.launchMethod = createResponseBody.launchMethod === "OwnWindow" ? "newWindow" : "iframe";

                        return getClientSafeSession(result);
                    }
                },

                {
                    method: "GET",
                    path: "/sessions/{id}",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        const result = await req.server.app.db.first("*").from("sessions").queryContext({jsonCols: ["metadata"]}).where({tenantId: req.auth.credentials.tenantId, id: req.params.id});

                        if (! result) {
                            return Boom.notFound();
                        }

                        return getClientSafeSession(result);
                    }
                },

                {
                    method: "GET",
                    path: "/sessions/{id}/return-url",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        const tenantId = req.auth.credentials.tenantId,
                            db = req.server.app.db,
                            result = await db.first("*").from("sessions").queryContext({jsonCols: ["metadata"]}).where({tenantId, id: req.params.id});

                        if (! result) {
                            return Boom.notFound();
                        }

                        await h.sessionEvent(req.params.id, tenantId, db, {kind: "spec", resource: "return-url", summary: "Return URL loaded"});

                        return "<html><body>Session has ended, use &quot;Close&quot; button to return to test details page.</body></html>";
                    }
                },

                {
                    method: "GET",
                    path: "/sessions/{id}/logs",
                    options: {
                        tags: ["api"],
                        validate: {
                            query: Joi.object({
                                listen: Joi.any().optional().description("Switches the response to be a stream that will provide additional logs as they are created")
                            }).optional().label("RequestParams-SessionLogs")
                        }
                    },
                    handler: async (req, h) => {
                        const tenantId = req.auth.credentials.tenantId,
                            db = req.server.app.db,
                            result = await db.first("id").from("sessions").where({tenantId, id: req.params.id});

                        if (! result) {
                            return Boom.notFound();
                        }

                        const logs = await db.select("*").queryContext({jsonCols: ["metadata"]}).from("sessions_logs").where({tenantId, sessionId: result.id}).orderBy("created_at", "desc");

                        if (! req.query.listen) {
                            return logs;
                        }

                        const channel = new stream.PassThrough,
                            response = h.response(channel);

                        sessions[req.params.id] = channel;

                        for (const log of logs) {
                            channel.write(JSON.stringify(log) + "\n");
                        }

                        req.raw.req.on(
                            "close",
                            () => {
                                delete sessions[req.params.id];
                            }
                        );

                        return response;
                    }
                },

                {
                    method: "POST",
                    path: "/sessions/{id}/abandon",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        const db = req.server.app.db,
                            sessionId = req.params.id,
                            tenantId = req.auth.credentials.tenantId,
                            result = await db.first("*").from("sessions").where({tenantId, id: sessionId });

                        if (! result) {
                            return Boom.notFound();
                        }

                        let abandonResponse,
                            abandonResponseBody;

                        try {
                            abandonResponse = await Wreck.request(
                                "POST",
                                `${req.server.app.player.baseUrl}/api/v1/session/${result.playerId}/abandon`,
                                {
                                    headers: {
                                        Authorization: await req.server.methods.playerBearerAuthHeader(req)
                                    }
                                }
                            );
                            abandonResponseBody = await Wreck.read(abandonResponse, {json: true});
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed request to player to abandon session: ${ex}`));
                        }

                        if (abandonResponse.statusCode !== 204) {
                            throw Boom.internal(new Error(`Failed to abandon session in player (${abandonResponse.statusCode}): ${abandonResponseBody.message}${abandonResponseBody.srcError ? " (" + abandonResponseBody.srcError + ")" : ""}`));
                        }

                        await h.sessionEvent(sessionId, tenantId, db, {kind: "spec", resource: "abandon", summary: "Session abandoned"});

                        return null;
                    }
                },

                {
                    method: "POST",
                    path: "/sessions/{id}/fetch",
                    options: {
                        // turn off auth because this is effectively an auth request
                        auth: false
                    },
                    handler: async (req, h) => {
                        const db = req.server.app.db;

                        try {
                            let session;

                            try {
                                session = await db.first("*").from("sessions").queryContext({jsonCols: ["metadata"]}).where({id: req.params.id});
                            }
                            catch (ex) {
                                throw Boom.internal(new Error(`Failed to select session data: ${ex}`));
                            }

                            if (! session) {
                                throw Boom.notFound(`session: ${req.params.id}`);
                            }

                            let fetchResponse,
                                fetchResponseBody;

                            try {
                                fetchResponse = await Wreck.request(
                                    "POST",
                                    session.playerFetch
                                );
                                fetchResponseBody = await Wreck.read(fetchResponse, {json: true});
                            }
                            catch (ex) {
                                throw Boom.internal(new Error(`Failed to request fetch url from player: ${ex}`));
                            }

                            await h.sessionEvent(req.params.id, session.tenantId, db, {kind: "spec", resource: "fetch", playerResponseStatusCode: fetchResponse.statusCode, summary: "Fetch URL used"});

                            return h.response(fetchResponseBody).code(fetchResponse.statusCode);
                        }
                        catch (ex) {
                            return h.response(
                                {
                                    "error-code": "3",
                                    "error-text": `General Application Error: ${ex}`
                                }
                            ).code(400);
                        }
                    }
                },

                // OPTIONS requests don't provide an authorization header, so set this up
                // as a separate route without auth
                {
                    method: [
                        "OPTIONS"
                    ],
                    path: "/sessions/{id}/lrs/{resource*}",
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
                                uri: `${req.server.app.player.baseUrl}/lrs/${req.params.resource}${req.url.search}`
                            })
                        }
                    }
                },

                //
                // proxy the LRS based on the session identifier so that the service
                // knows what session to log information for
                //
                {
                    method: [
                        "GET",
                        "POST",
                        "PUT",
                        "DELETE"
                    ],
                    path: "/sessions/{id}/lrs/{resource*}",
                    options: {
                        //
                        // since this is effectively acting as a proxy this route doesn't use
                        // direct authorization, it instead relies on the player's underlying
                        // handling to handle invalid authorization attempts
                        //
                        auth: false,
                        cors: false
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
                            id = req.params.id;
                        let session;

                        try {
                            session = await db.first("*").from("sessions").where({id}).queryContext({jsonCols: ["metadata"]});
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed to select session data: ${ex}`));
                        }

                        if (! session) {
                            throw Boom.notFound(`session: ${id}`);
                        }

                        const tenantId = session.tenantId;
                        let proxyResponse,
                            rawProxyResponsePayload,
                            response;

                        try {
                            //
                            // map the requested resource (i.e. "statements" or "activities/state") from the
                            // provided LRS endpoint to the resource at the underlying LRS endpoint, while
                            // maintaining any query string parameters
                            //
                            const uri = `${req.server.app.player.baseUrl}/lrs/${req.params.resource}${req.url.search}`,
                                protocol = uri.split(":", 1)[0],
                                options = {
                                    headers: Hoek.clone(req.headers),
                                    payload: req.payload
                                };

                            delete options.headers.host;
                            delete options.headers["content-length"];

                            if (req.info.remotePort) {
                                options.headers["x-forwarded-for"] = (options.headers["x-forwarded-for"] ? options.headers["x-forwarded-for"] + "," : "") + req.info.remoteAddress;
                                options.headers["x-forwarded-port"] = options.headers["x-forwarded-port"] || req.info.remotePort;
                                options.headers["x-forwarded-proto"] = options.headers["x-forwarded-proto"] || req.server.info.protocol;
                                options.headers["x-forwarded-host"] = options.headers["x-forwarded-host"] || req.info.host;
                            }

                            proxyResponse = await Wreck.request(req.method, uri, options);
                            rawProxyResponsePayload = await Wreck.read(proxyResponse, {gunzip: true});

                            let responsePayload = rawProxyResponsePayload;

                            if (req.method === "get" && req.params.resource === "activities/state") {
                                if (req.query.stateId === "LMS.LaunchData") {
                                    const parsedPayload = JSON.parse(rawProxyResponsePayload.toString());

                                    if (typeof parsedPayload.returnURL !== "undefined") {
                                        parsedPayload.returnURL = parsedPayload.returnURL.replace("__sessionId__", id);
                                    }

                                    responsePayload = parsedPayload;
                                }
                            }

                            response = h.response(responsePayload).passThrough(true);

                            response.code(proxyResponse.statusCode);
                            response.message(proxyResponse.statusMessage);

                            const skipHeaders = {
                                "content-encoding": true,
                                "content-length": true,
                                "transfer-encoding": true
                            };
                            for (const [k, v] of Object.entries(proxyResponse.headers)) {
                                if (! skipHeaders[k.toLowerCase()]) {
                                    response.header(k, v);
                                }
                            }

                            // clean up the original response
                            proxyResponse.destroy();
                        }
                        catch (ex) {
                            throw ex;
                        }

                        if (proxyResponse.statusCode !== 200 && proxyResponse.statusCode !== 204 && proxyResponse.headers["content-type"].startsWith("application/json")) {
                            const proxyResponsePayloadAsString = rawProxyResponsePayload.toString();
                            let proxyResponsePayload;

                            try {
                                proxyResponsePayload = JSON.parse(proxyResponsePayloadAsString);
                            }
                            catch (ex) {
                                console.log(`Failed JSON parse of LRS response error: ${ex} (${proxyResponsePayloadAsString})`);
                            }

                            if (proxyResponsePayload && typeof proxyResponsePayload.violatedReqId !== "undefined") {
                                session.metadata.violatedReqIds.push(proxyResponsePayload.violatedReqId);

                                try {
                                    await db("sessions").update({metadata: JSON.stringify(session.metadata)}).where({id, tenantId});
                                }
                                catch (ex) {
                                    console.log(`Failed to update session for violated spec requirement (${proxyResponsePayload.violatedReqId}): ${ex}`);
                                }

                                await h.sessionEvent(id, tenantId, db, {kind: "lrs", violatedReqId: proxyResponsePayload.violatedReqId, summary: `Spec requirement violated`});
                            }
                        }

                        if (req.method === "get") {
                            if (req.params.resource === "activities/state") {
                                if (req.query.stateId === "LMS.LaunchData") {
                                    await h.sessionEvent(id, tenantId, db, {kind: "lrs", method: req.method, resource: req.params.resource, summary: "LMS Launch Data retrieved"});
                                }
                            }
                            else if (req.params.resource === "activities") {
                                if (req.query.activityId !== null) {
                                    await h.sessionEvent(id, tenantId, db, {kind: "lrs", method: req.method, resource: req.params.resource, summary: "Activity " + req.query.activityId + " retrieved"});
                                }
                            }
                            else if (req.params.resource === "agents/profile") {
                                if (req.query.profileId === "cmi5LearnerPreferences") {
                                    await h.sessionEvent(id, tenantId, db, {kind: "lrs", method: req.method, resource: req.params.resource, summary: "Learner Preferences Agent Profile Retrieved"});
                                }
                            }
                            else {
                                await h.sessionEvent(id, tenantId, db, {kind: "lrs", method: req.method, resource: req.params.resource, summary: "Unknown"});
                            }
                        }
                        else if (req.method === "put" || req.method === "post") {
                            if (req.params.resource === "statements") {
                                if (proxyResponse.statusCode === 200 || proxyResponse.statusCode === 204) {
                                    let statements = req.payload;

                                    if (! Array.isArray(statements)) {
                                        statements = [statements];
                                    }

                                    for (const st of statements) {
                                        await h.sessionEvent(id, tenantId, db, {kind: "lrs", method: req.method, resource: req.params.resource, summary: `Statement recorded: ${st.verb.id}`});
                                    }
                                }
                                else {
                                    await h.sessionEvent(id, tenantId, db, {kind: "lrs", method: req.method, resource: req.params.resource, summary: `Statement(s) rejected: ${proxyResponse.statusCode}`});
                                }
                            }
                        }

                        return response;
                    }
                }
            ]
        );
    }
};
