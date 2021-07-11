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
    { v4: uuidv4 } = require("uuid"),
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
                if (rawData.kind !== "control") {
                    await db.insert(
                        {
                            tenantId,
                            sessionId,
                            metadata: JSON.stringify(rawData)
                        }
                    ).into("sessions_logs");
                }

                if (sessions[sessionId]) {
                    sessions[sessionId].write(JSON.stringify(rawData) + "\n");
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
                        tags: ["api"]
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
                                        reg: queryResult.registrations.code,
                                        actor: queryResult.registrations.metadata.actor,
                                        returnUrl: `${baseUrl}/api/v1/sessions/__sessionId__/return-url`,
                                        alternateEntitlementKey: req.payload.alternateEntitlementKey,
                                        contextTemplateAdditions: req.payload.contextTemplateAdditions,
                                        launchMode: req.payload.launchMode,
                                        launchMethod: req.payload.launchMethod,
                                        launchParameters: req.payload.launchParameters,
                                        masteryScore: req.payload.masteryScore,
                                        moveOn: req.payload.moveOn
                                    }
                                }
                            );
                            createResponseBody = await Wreck.read(createResponse, {json: true});
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed to request AU launch url from player: ${ex}`));
                        }

                        if (createResponse.statusCode !== 200) {
                            throw Boom.internal(new Error(`Failed to retrieve AU launch URL (${createResponse.statusCode}): ${createResponseBody.message}${createResponseBody.srcError ? " (" + createResponseBody.srcError + ")" : ""}`));
                        }

                        const playerAuLaunchUrl = createResponseBody.url,
                            playerAuLaunchUrlParsed = new URL(playerAuLaunchUrl),
                            playerEndpoint = playerAuLaunchUrlParsed.searchParams.get("endpoint"),
                            playerFetch = playerAuLaunchUrlParsed.searchParams.get("fetch");
                        let sessionId;

                        try {
                            sessionId = await db.insert(
                                {
                                    tenant_id: tenantId,
                                    player_id: createResponseBody.id,
                                    registration_id: testId,
                                    player_au_launch_url: playerAuLaunchUrl,
                                    player_endpoint: playerEndpoint,
                                    player_fetch: playerFetch,
                                    metadata: JSON.stringify(
                                        {
                                            version: 1,
                                            launchMethod: createResponseBody.launchMethod
                                        }
                                    )
                                }
                            ).into("sessions");
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed to insert into sessions: ${ex}`));
                        }

                        h.sessionEvent(sessionId, tenantId, db, {kind: "spec", resource: "sessions", summary: "AU " + queryResult.courses.metadata.aus[auIndex].title[0].text + " launch session initiated"});

                        //
                        // swap endpoint, fetch for proxied versions
                        //
                        playerAuLaunchUrlParsed.searchParams.set("endpoint", `${baseUrl}/api/v1/sessions/${sessionId}/lrs`);
                        playerAuLaunchUrlParsed.searchParams.set("fetch", `${baseUrl}/api/v1/sessions/${sessionId}/fetch`);

                        const ctsLaunchUrl = playerAuLaunchUrlParsed.href;
                        const result = await db.first("*").from("sessions").queryContext({jsonCols: ["metadata"]}).where({tenantId, id: sessionId});

                        result.launchUrl = ctsLaunchUrl;
                        result.launchMethod = createResponseBody.launchMethod;

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
                    method: "DELETE",
                    path: "/sessions/{id}",
                    options: {
                        tags: ["api"]
                    },
                    handler: {
                        proxy: {
                            passThrough: true,
                            xforward: true,

                            mapUri: async (req) => {
                                const result = await req.server.app.db.first("playerId").from("courses").where({tenantId: req.auth.credentials.tenantId, id: req.params.id});

                                return {
                                    uri: `${req.server.app.player.baseUrl}/api/v1/course/${result.playerId}`
                                };
                            },

                            onResponse: async (err, res, req, h, settings) => {
                                if (err !== null) {
                                    // clean up the original response
                                    res.destroy();

                                    throw new Error(err);
                                }

                                if (res.statusCode !== 204) {
                                    // clean up the original response
                                    res.destroy();

                                    throw new Error(res.statusCode);
                                }
                                const db = req.server.app.db;

                                // clean up the original response
                                res.destroy();

                                let deleteResult;
                                try {
                                    deleteResult = await db("courses").where({tenantId: req.auth.credentials.tenantId, id: req.params.id}).delete();
                                }
                                catch (ex) {
                                    throw new Error(ex);
                                }

                                return null;
                            }
                        }
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

                        h.sessionEvent(req.params.id, tenantId, db, {kind: "spec", resource: "return-url", summary: "Return URL loaded"});

                        return "<html><body>Session has ended, use &quot;Close&quot; button to return to test details page.</body></html>";
                    }
                },

                {
                    method: "GET",
                    path: "/sessions/{id}/events",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        const tenantId = req.auth.credentials.tenantId,
                            db = req.server.app.db,
                            result = await db.first("id").from("sessions").where({tenantId, id: req.params.id});

                        if (! result) {
                            return Boom.notFound();
                        }

                        const logs = await db.select("*").from("sessions_logs").where({tenantId, sessionId: result.id}).orderBy("created_at"),
                            channel = new stream.PassThrough,
                            response = h.response(channel);

                        sessions[req.params.id] = channel;

                        h.sessionEvent(req.params.id, tenantId, db, {kind: "control", resource: "events", summary: "Event stream started"});

                        for (const log of logs) {
                            channel.write(log.metadata + "\n");
                        }

                        req.raw.req.on(
                            "close",
                            () => {

                                h.sessionEvent(req.params.id, tenantId, db, {kind: "control", resource: "events", summary: "Event stream closed"});
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

                        h.sessionEvent(sessionId, tenantId, db, {kind: "spec", resource: "sessions", summary: "Session abandoned"});

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
                            h.sessionEvent(req.params.id, session.tenantId, db, {kind: "spec", resource: "fetch", playerResponseStatusCode: fetchResponse.statusCode, summary: "Fetch URL used"});

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

                //
                // proxy the LRS based on the session identifier so that the service
                // knows what session to log information for
                //
                {
                    method: [
                        "GET",
                        "POST",
                        "PUT",
                        "DELETE",
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
                        cors: false,

                        //
                        // set up a pre-request handler to handle capturing meta information about the xAPI
                        // requests before proxying the request to the underlying LRS (which is proxied from
                        // the player)
                        //
                        pre: [
                            async (req, h) => {
                                const db = req.server.app.db;
                                let session;

                                try {
                                    session = await db.first("*").from("sessions").where({id: req.params.id});
                                }
                                catch (ex) {
                                    throw Boom.internal(new Error(`Failed to select session data: ${ex}`));
                                }

                                if (! session) {
                                    throw Boom.notFound(`session: ${req.params.id}`);
                                }

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
                                uri: `${req.server.app.player.baseUrl}/lrs/${req.params.resource}${req.url.search}`
                            }),

                            //
                            // hook into the response provided back from the LRS to capture details such as
                            // the status code, error messages, etc.
                            //
                            onResponse: async (err, res, req, h, settings) => {
                                if (err !== null) {
                                    throw new Error(`LRS request failed: ${err}`);
                                }

                                let session;
                                const db = req.server.app.db;

                                try {
                                    session = await db.first("*").from("sessions").where({id: req.params.id});
                                }
                                catch (ex) {
                                    throw Boom.internal(new Error(`Failed to select session data: ${ex}`));
                                }

                                if (! session) {
                                    throw Boom.notFound(`session: ${req.params.id}`);
                                }

                                let payload;
                                if (res.statusCode !== 204) {
                                    payload = await Wreck.read(res);
                                }

                                let responsePayload = payload;

                                if (res.statusCode !== 204 && res.statusCode !== 200) {
                                    console.log("lrs h2o2.onResponse - error response", payload.toString());
                                }
                                else {
                                    if (req.method === "get" && req.params.resource === "activities/state") {
                                        if (req.query.stateId === "LMS.LaunchData") {
                                            const parsedPayload = JSON.parse(payload.toString());

                                            parsedPayload.returnURL = parsedPayload.returnURL.replace("__sessionId__", req.params.id);

                                            // altering the body means the content length would be off,
                                            // we could just adjust it based on the size difference
                                            delete res.headers["content-length"];

                                            responsePayload = parsedPayload;
                                        }
                                    }
                                }

                                const response = h.response(responsePayload);

                                response.code(res.statusCode);
                                response.message(res.statusMessage);

                                for (const [k, v] of Object.entries(res.headers)) {
                                    if (k.toLowerCase() !== "transfer-encoding") {
                                        response.header(k, v);
                                    }
                                }

                                // clean up the original response
                                res.destroy();

                                if (req.method === "get") {
                                    if (req.params.resource === "activities/state") {
                                        if (req.query.stateId === "LMS.LaunchData") {
                                            h.sessionEvent(
                                                req.params.id,
                                                session.tenantId,
                                                db,
                                                {
                                                    kind: "lrs",
                                                    method: req.method,
                                                    resource: req.params.resource,
                                                    summary: "LMS Launch Data retrieved",
                                                    summaryDetail: [
                                                        response.source.contextTemplate !== null ? "contextTemplate confirmed" : "contextTemplate not present",
                                                        response.source.launchMode !== null ? "launchMode confirmed" : "launchMode not present",
                                                        response.source.launchMethod !== null ? "launchMethod confirmed" : "launchMethod not present",
                                                        response.source.launchParameters !== null ? "launchParameters confirmed" : "launchParameters not present",
                                                        response.source.entitlementKey !== null ? "entitlementKey confirmed" : "entitlementKey not present",
                                                        response.source.moveOn !== null ? "moveOn confirmed" : "moveOn not present",
                                                        response.source.returnUrl !== null ? "returnUrl confirmed" : "returnUrl not present"
                                                    ]
                                                }
                                            )
                                        }
                                    }
                                    else if (req.params.resource === "activities") {
                                        if (req.query.activityId !== null) {
                                            h.sessionEvent(req.params.id, session.tenantId, db, {kind: "lrs", method: req.method, resource: req.params.resource, summary: "Activity " + req.query.activityId + " retrieved"});
                                        }
                                    }
                                    else if (req.params.resource === "agents/profile") {
                                        if (req.query.profileId === "cmi5LearnerPreferences") {
                                            h.sessionEvent(req.params.id, session.tenantId, db, {kind: "lrs", method: req.method, resource: req.params.resource, summary: "Learner Preferences Agent Profile Retrieved"});
                                        }
                                    }
                                    else {
                                        h.sessionEvent(req.params.id, session.tenantId, db, {kind: "lrs", method: req.method, resource: req.params.resource, summary: "Unknown"});
                                    }
                                }

                                else if (req.method === "put" || req.method === "post") {
                                    if (req.params.resource === "statements") {
                                        h.sessionEvent(req.params.id, session.tenantId, db, {kind: "lrs", method: req.method, resource: req.params.resource, summary: "Statement recorded"});
                                    }
                                }

                                return response;
                            }
                        }
                    }
                }
            ]
        );
    }
};
