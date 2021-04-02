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
    name: "catapult-cts-api-routes-v1-sessions",
    register: (server, options) => {
        server.route(
            [
                //
                // not proxying this request because have to alter the body based on
                // converting the CTS course id to the stored Player course id
                //
                {
                    method: "POST",
                    path: "/sessions",
                    handler: async (req, h) => {
                        const db = req.server.app.db,
                            baseUrl = `${req.url.protocol}//${req.url.host}`;

                        let queryResult;

                        try {
                            queryResult = await db
                                .first("*")
                                .from("registrations")
                                .leftJoin("courses", "registrations.course_id", "courses.id")
                                .where("registrations.id", req.payload.testId)
                                .options({nestTables: true});
                        }
                        catch (ex) {
                            throw Boom.internal(`Failed to retrieve registration for id ${req.payload.testId}: ${ex}`);
                        }

                        if (! queryResult) {
                            throw Boom.notFound(`registration: ${req.payload.testId}`);
                        }

                        let createResponse,
                            createResponseBody;

                        try {
                            createResponse = await Wreck.request(
                                "POST",
                                `${req.server.app.player.baseUrl}/api/v1/courses/${queryResult.courses.player_id}/launch-url/${req.payload.auIndex}`,
                                {
                                    payload: {
                                        reg: queryResult.registrations.code,
                                        actor: queryResult.registrations.metadata.actor
                                    }
                                }
                            );
                            createResponseBody = await Wreck.read(createResponse, {json: true});
                        }
                        catch (ex) {
                            throw Boom.internal(`Failed to request AU launch url from player: ${ex}`);
                        }

                        if (createResponse.statusCode !== 200) {
                            throw Boom.internal(`Failed to retrieve AU launch URL (${createResponse.statusCode}): ${createResponse.message} (${createResponse.srcError})`);
                        }

                        const playerLaunchUrl = createResponseBody.url,
                            playerLaunchUrlParsed = new URL(playerLaunchUrl),
                            playerEndpoint = playerLaunchUrlParsed.searchParams.get("endpoint"),
                            playerFetch = playerLaunchUrlParsed.searchParams.get("fetch");
                        let sessionId;

                        try {
                            sessionId = await db.insert(
                                {
                                    tenant_id: 1,
                                    player_id: createResponseBody.id,
                                    registration_id: req.payload.testId,
                                    player_launch_url: playerLaunchUrl,
                                    player_endpoint: playerEndpoint,
                                    player_fetch: playerFetch,
                                    metadata: JSON.stringify({})
                                }
                            ).into("sessions");
                        }
                        catch (ex) {
                            throw Boom.internal(`Failed to insert into sessions: ${ex}`);
                        }

                        //
                        // swap endpoint, fetch for proxied versions
                        //
                        playerLaunchUrlParsed.searchParams.set("endpoint", `${baseUrl}/sessions/${sessionId}/lrs`);
                        playerLaunchUrlParsed.searchParams.set("fetch", `${baseUrl}/sessions/${sessionId}/fetch`);

                        const ctsLaunchUrl = playerLaunchUrlParsed.href;
                        const result = await db.first("*").from("sessions").queryContext({jsonCols: ["metadata"]}).where("id", sessionId);

                        delete result.playerId;
                        delete result.playerLaunchUrl;
                        delete result.playerEndpoint;
                        delete result.playerFetch;

                        result.launchUrl = ctsLaunchUrl;

                        return result;
                    }
                },

                {
                    method: "GET",
                    path: "/sessions/{id}",
                    handler: async (req, h) => {
                        const result = await req.server.app.db.first("*").from("sessions").queryContext({jsonCols: ["metadata"]}).where("id", req.params.id);

                        if (! result) {
                            return Boom.notFound();
                        }

                        return result;
                    }
                },

                {
                    method: "DELETE",
                    path: "/sessions/{id}",
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
