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
    Joi = require("joi"),
    registrations = {},
    { v4: uuidv4 } = require("uuid");

module.exports = {
    name: "catapult-cts-api-routes-v1-tests",
    register: (server, options) => {
        server.decorate(
            "toolkit",
            "registrationEvent",
            async (registrationId, tenantId, db, rawData) => {
                if (rawData.kind !== "control") {
                    await db.insert(
                        {
                            tenantId,
                            registrationId,
                            metadata: JSON.stringify(rawData)
                        }
                    ).into("registrations_logs");
                }

                if (registrations[registrationId]) {
                    registrations[registrationId].write(JSON.stringify(rawData) + "\n");
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
                    path: "/tests",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        const db = req.server.app.db;

                        let course;

                        try {
                            course = await db.first("*").from("courses").queryContext({jsonCols: ["metadata"]}).where({tenantId: req.auth.credentials.tenantId, id: req.payload.courseId});
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed to retrieve course for id ${req.payload.courseId}: ${ex}`));
                        }

                        if (! course) {
                            throw Boom.notFound(`course: ${req.payload.courseId}`);
                        }

                        let createResponse,
                            createResponseBody;

                        try {
                            createResponse = await Wreck.request(
                                "POST",
                                `${req.server.app.player.baseUrl}/api/v1/registration`,
                                {
                                    headers: {
                                        Authorization: await req.server.methods.playerBearerAuthHeader(req)
                                    },
                                    payload: {
                                        courseId: course.playerId,
                                        actor: req.payload.actor
                                    }
                                }
                            );
                            createResponseBody = await Wreck.read(createResponse, {json: true});
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed request to create player registration: ${ex}`));
                        }

                        if (createResponse.statusCode !== 200) {
                            throw Boom.internal(new Error(`Failed to create player registration (${createResponse.statusCode}): ${createResponseBody.message} (${createResponseBody.srcError})`));
                        }

                        createResponseBody.actor = JSON.parse(createResponseBody.actor);

                        let insertResult;
                        try {
                            insertResult = await db.insert(
                                {
                                    tenant_id: req.auth.credentials.tenantId,
                                    player_id: createResponseBody.id,
                                    code: createResponseBody.code,
                                    course_id: req.payload.courseId,
                                    metadata: JSON.stringify({
                                        actor: createResponseBody.actor
                                    })
                                }
                            ).into("registrations");
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed to insert into registrations: ${ex}`));
                        }

                        const result = db.first("*").from("registrations").queryContext({jsonCols: ["metadata"]}).where({tenantId: req.auth.credentials.tenantId, id: insertResult});

                        h.registrationEvent(insertResult, req.auth.credentials.tenantId, db, {kind: "spec", resource: "create", playerResponseStatusCode: result.statusCode, summary: "Registration Created"});

                        delete result.playerId;

                        return result;
                    }
                },

                {
                    method: "GET",
                    path: "/tests/{id}",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        const result = await req.server.app.db.first("*").from("registrations").queryContext({jsonCols: ["metadata"]}).where({tenantId: req.auth.credentials.tenantId, id: req.params.id});

                        if (! result) {
                            return Boom.notFound();
                        }

                        return result;
                    }
                },

                {
                    method: "DELETE",
                    path: "/tests/{id}",
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

                                // TODO: failures beyond this point leave an orphaned course in the cts
                                //       with no upstream course in the player
                                //       just become a warning in the log?

                                const db = req.server.app.db;

                                // clean up the original response
                                res.destroy();

                                let deleteResult;
                                try {
                                    deleteResult = await db("courses").where("id", req.params.id).delete();
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
                    path: "/tests/{id}/logs",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => {

                        const tenantId = req.auth.credentials.tenantId,
                            db = req.server.app.db,
                            sessionsLogs = {},
                            registrationsLogs = {},

                            sessionsLogsResult = await db.select("sessions_logs.id", "sessions_logs.created_at", "sessions_logs.updated_at", "sessions_logs.tenant_id", "sessions_logs.session_id", "sessions_logs.metadata")
                                .from("sessions_logs")
                                .queryContext({jsonCols: ["metadata"]})
                                .leftJoin("sessions", function () {
                                    this.on("sessions_logs.session_id", "=", "sessions.id") // eslint-disable-line no-invalid-this, semi
                                    this.andOn("sessions_logs.tenant_id", "=", "sessions.tenant_id") // eslint-disable-line no-invalid-this, semi
                                })
                                .where({"sessions.registration_id": req.params.id}, tenantId),

                            registrationsLogsResult = await db.select("registrations_logs.id", "registrations_logs.created_at", "registrations_logs.updated_at", "registrations_logs.tenant_id", "registrations_logs.registration_id", "registrations_logs.metadata")
                                .from("registrations_logs")
                                .queryContext({jsonCols: ["metadata"]})
                                .where({registration_id: req.params.id}, tenantId);

                        sessionsLogsResult.forEach((log) => {
                            if (sessionsLogs[log.sessionId] === undefined) { // eslint-disable-line no-undefined
                                sessionsLogs[log.sessionId] = [];
                            }
                            sessionsLogs[log.sessionId].push(log);
                        }
                        );

                        registrationsLogsResult.forEach((log) => {
                            if (registrationsLogs[log.registrationId] === undefined) { // eslint-disable-line no-undefined
                                registrationsLogs[log.registrationId] = [];
                            }
                            registrationsLogs[log.registrationId].push(log);
                        }
                        );

                        return {sessionsLogs, registrationsLogs};
                    }
                },

                {
                    method: "POST",
                    path: "/tests/{id}/waive-au/{auIndex}",
                    options: {
                        tags: ["api"],
                        payload: {
                            parse: true
                        },
                        validate: {
                            payload: Joi.object({
                                reason: Joi.string().required()
                            }).label("Request-WaiveAU")
                        }
                    },
                    handler: async (req, h) => {
                        const db = req.server.app.db,
                            registrationId = req.params.id,
                            auIndex = req.params.auIndex,
                            tenantId = req.auth.credentials.tenantId,
                            result = await db.first("*").from("registrations").where({tenantId, id: registrationId});

                        if (! result) {
                            return Boom.notFound();
                        }

                        let waiveResponse,
                            waiveResponseBody;

                        try {
                            waiveResponse = await Wreck.request(
                                "POST",
                                `${req.server.app.player.baseUrl}/api/v1/registration/${result.playerId}/waive-au/${auIndex}`,
                                {
                                    headers: {
                                        Authorization: await req.server.methods.playerBearerAuthHeader(req)
                                    },
                                    payload: {
                                        reason: req.payload.reason
                                    }
                                }
                            );
                            waiveResponseBody = await Wreck.read(waiveResponse, {json: true});
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed request to player to waive AU: ${ex}`));
                        }

                        if (waiveResponse.statusCode !== 204) {
                            throw Boom.internal(new Error(`Failed to waive AU in player registration (${waiveResponse.statusCode}): ${waiveResponseBody.message} (${waiveResponseBody.srcError})`));
                        }

                        h.registrationEvent(registrationId, tenantId, db, {kind: "spec", resource: "waive-au+AU", summary: `Waived (${auIndex})`});

                        return null;
                    }
                }
            ]
        );
    }
};
