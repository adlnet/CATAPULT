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
    name: "catapult-cts-api-routes-v1-courses",
    register: (server, options) => {
        server.route(
            [
                {
                    method: "POST",
                    path: "/courses",
                    options: {
                        tags: ["api"],

                        // arbitrarily chosen large number (480 MB)
                        payload: {
                            maxBytes: 1024 * 1024 * 480,
                        },
                        pre: [
                            async (req, h) => {
                                req.headers.authorization = await req.server.methods.playerBearerAuthHeader(req);

                                return null;
                            }
                        ]
                    },
                    handler: {
                        proxy: {
                            passThrough: true,
                            xforward: true,
                            acceptEncoding: false,

                            mapUri: (req) => ({
                                uri: `${req.server.app.player.baseUrl}/api/v1/course`
                            }),

                            onResponse: async (err, res, req, h, settings) => {
                                if (err !== null) {
                                    throw Boom.internal(new Error(`Failed proxied import request: ${err}`));
                                }

                                let payload;
                                try {
                                    payload = await Wreck.read(res, {json: true});
                                }
                                catch (ex) {
                                    // clean up the original response
                                    res.destroy();

                                    throw Boom.internal(new Error(`Failed to parse player request response: ${ex}`));
                                }

                                // clean up the original response
                                res.destroy();

                                if (res.statusCode !== 200) {
                                    throw Boom.badRequest(new Error(`Failed request to player import: ${payload.message} (${payload.srcError})`), {statusCode: res.statusCode});
                                }

                                const db = req.server.app.db;

                                let insertResult;
                                try {
                                    insertResult = await db.insert(
                                        {
                                            tenant_id: req.auth.credentials.tenantId,
                                            player_id: payload.id,
                                            metadata: JSON.stringify({
                                                version: 1,
                                                structure: payload.structure,
                                                aus: payload.metadata.aus
                                            })
                                        }
                                    ).into("courses");
                                }
                                catch (ex) {
                                    throw Boom.internal(new Error(`Failed to insert course (${payload.id}): ${ex}`));
                                }

                                return db.first("*").from("courses").queryContext({jsonCols: ["metadata"]}).where({tenantId: req.auth.credentials.tenantId, id: insertResult});
                            }
                        }
                    }
                },

                {
                    method: "GET",
                    path: "/courses",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        const db = req.server.app.db,
                            items = await db
                                .select(
                                    "*"
                                )
                                .from("courses")
                                .leftJoin(
                                    db
                                        .select("course_id", db.max("created_at").as("tested_at"))
                                        .from("registrations")
                                        .where({"registrations.tenant_id": req.auth.credentials.tenantId})
                                        .groupBy("course_id")
                                        .as("most_recent_test"),
                                    "most_recent_test.course_id",
                                    "courses.id"
                                )
                                .leftJoin(
                                    "registrations",
                                    function () {
                                        this.on("registrations.course_id", "most_recent_test.course_id");
                                        this.andOn("registrations.created_at", "most_recent_test.tested_at")
                                    }
                                )
                                .where({"courses.tenant_id": req.auth.credentials.tenantId})
                                .orderBy("courses.created_at", "desc")
                                .options({nestTables: true})
                                .queryContext({jsonCols: ["courses.metadata", "registrations.metadata"]});

                        return {
                            items: items.map(
                                (row) => ({
                                    id: row.courses.id,
                                    createdAt: row.courses.created_at,
                                    metadata: row.courses.metadata,
                                    lastTested: row.mostRecentTest.tested_at,
                                    testResult: row.registrations.metadata ? row.registrations.metadata.result : "not-started",
                                    testId: row.registrations.id
                                })
                            )
                        };
                    }
                },

                {
                    method: "GET",
                    path: "/courses/{id}",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        const result = await req.server.app.db.first("*").from("courses").queryContext({jsonCols: ["metadata"]}).where({tenantId: req.auth.credentials.tenantId, id: req.params.id});

                        if (! result) {
                            return Boom.notFound();
                        }

                        return result;
                    }
                },

                {
                    method: "DELETE",
                    path: "/courses/{id}",
                    options: {
                        tags: ["api"],
                        pre: [
                            async (req, h) => {
                                req.headers.authorization = await req.server.methods.playerBearerAuthHeader(req);

                                return null;
                            }
                        ]
                    },
                    handler: {
                        proxy: {
                            passThrough: true,
                            xforward: true,

                            mapUri: async (req) => {
                                const result = await req.server.app.db.first("playerId").from("courses").where({tenantId: req.auth.credentials.tenantId, id: req.params.id});

                                if (! result) {
                                    throw Boom.internal(new Error(`Failed to retrieve player id for course: ${req.params.id}`));
                                }

                                return {
                                    uri: `${req.server.app.player.baseUrl}/api/v1/course/${result.playerId}`
                                };
                            },

                            onResponse: async (err, res, req, h, settings) => {
                                if (err !== null) {
                                    // clean up the original response
                                    res.destroy();

                                    throw Boom.internal(new Error(`Failed proxied delete request: ${err}`));
                                }

                                if (res.statusCode !== 204) {
                                    let payload;
                                    try {
                                        payload = await Wreck.read(res, {json: true});
                                    }
                                    catch (ex) {
                                        // clean up the original response
                                        res.destroy();

                                        throw Boom.internal(new Error(`Failed to parse player request response (${res.statusCode}): ${ex}`));
                                    }

                                    // clean up the original response
                                    res.destroy();

                                    throw Boom.internal(new Error(`Failed request to player delete: ${payload.message} (${payload.srcError})`), {statusCode: res.statusCode});
                                }


                                // clean up the original response
                                res.destroy();

                                const db = req.server.app.db;

                                let deleteResult;
                                try {
                                    deleteResult = await db("courses").where({tenantId: req.auth.credentials.tenantId, id: req.params.id}).delete();
                                }
                                catch (ex) {
                                    throw Boom.internal(new Error(`Failed to delete course from database: ${ex}`));
                                }

                                return null;
                            }
                        }
                    }
                },

                {
                    method: "GET",
                    path: "/courses/{id}/tests",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => ({
                        items: await req.server.app.db.select("*").queryContext({jsonCols: ["metadata"]}).from("registrations").where({tenantId: req.auth.credentials.tenantId, courseId: req.params.id})
                    })
                }
            ]
        );
    }
};
