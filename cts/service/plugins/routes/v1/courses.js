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
                                    const error = Boom.boomify(new Error(err));
                                    error.output.payload.srcError = error.message;

                                    return error;
                                }

                                let payload;
                                try {
                                    payload = await Wreck.read(res, {json: true});
                                }
                                catch (ex) {
                                    const error = Boom.boomify(new Error(`Failed to parse player request response: ${ex}`));
                                    error.output.payload.srcError = error.message;

                                    return error;
                                }

                                // clean up the original response
                                res.destroy();

                                if (res.statusCode !== 200) {
                                    throw Boom.boomify(new Error(`Player course import failed: ${payload.message}`), {statusCode: res.statusCode});
                                }

                                const db = req.server.app.db;

                                let insertResult;
                                try {
                                    insertResult = await db.insert(
                                        {
                                            tenant_id: 1,
                                            player_id: payload.id,
                                            metadata: JSON.stringify({
                                                version: 1,
                                                structure: JSON.parse(payload.structure)
                                            })
                                        }
                                    ).into("courses");
                                }
                                catch (ex) {
                                    throw Boom.boomify(new Error(ex));
                                }

                                return db.first("*").from("courses").where("id", insertResult);
                            }
                        }
                    }
                },

                {
                    method: "GET",
                    path: "/courses",
                    handler: async (req, h) => ({
                        items: await req.server.app.db.select("*").queryContext({jsonCols: ["metadata"]}).from("courses")
                    })
                },

                {
                    method: "GET",
                    path: "/courses/{id}",
                    handler: async (req, h) => {
                        const result = await req.server.app.db.first("*").from("courses").where("id", req.params.id);

                        if (! result) {
                            return Boom.notFound();
                        }

                        return result;
                    }
                },

                {
                    method: "DELETE",
                    path: "/courses/{id}",
                    handler: {
                        proxy: {
                            passThrough: true,
                            xforward: true,

                            mapUri: async (req) => {
                                const result = await req.server.app.db.first("playerId").from("courses").where("id", req.params.id);

                                return {
                                    uri: `${req.server.app.player.baseUrl}/api/v1/course/${result.playerId}`
                                };
                            },

                            onResponse: async (err, res, req, h, settings) => {

                                if (err !== null) {
                                    throw new Error(err);
                                }

                                if (res.statusCode !== 204) {
                                    throw new Error(res.statusCode);
                                }

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
                }
            ]
        );
    }
};
