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
    { v4: uuidv4 } = require("uuid");

module.exports = {
    name: "catapult-cts-api-routes-v1-tests",
    register: (server, options) => {
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
                                        Authorization: await req.server.methods.playerAuthHeader(req)
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
                    method: "POST",
                    path: "/tests/{id}/waive-au/{auIndex}",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        let waiveResponse,
                            waiveResponseBody;

                        try {
                            waiveResponse = await Wreck.request(
                                "POST",
                                `${req.server.app.player.baseUrl}/api/v1/registration/${req.params.id}/waive-au/${req.params.auIndex}`,
                                {
                                    headers: {
                                        Authorization: await req.server.methods.playerAuthHeader(req)
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

                        if (waiveResponse.statusCode !== 200) {
                            throw Boom.internal(new Error(`Failed to waive AU in player registration (${waiveResponse.statusCode}): ${waiveResponseBody.message} (${waiveResponseBody.srcError})`));
                        }
                    }
                }
            ]
        );
    }
};
