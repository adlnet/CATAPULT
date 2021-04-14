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
const Boom = require("@hapi/boom");

module.exports = {
    name: "catapult-player-api-routes-spec",
    register: (server, options) => {
        server.route(
            {
                method: "POST",
                path: "/fetch-url/{sessionId}",
                handler: async (req, h) => {
                    const db = req.server.app.db;
                    let session;

                    try {
                        session = await db.first("*").from("sessions").where(
                            {
                                id: req.params.sessionId
                            }
                        );
                    }
                    catch (ex) {
                        throw Boom.internal(new Error(`Failed to select session: ${ex}`));
                    }

                    if (! session) {
                        throw Boom.notFound(new Error(`session: ${req.params.sessionId}`));
                    }

                    if (session.launchTokenFetched) {
                        return h.response(
                            {
                                "error-code": "1",
                                "error-text": "Already in Use"
                            }
                        ).code(200).type("application/json");
                    }

                    try {
                        await db("sessions").where("id", session.id).update(
                            {
                                launch_token_fetched: true
                            }
                        );
                    }
                    catch (ex) {
                        throw Boom.internal(new Error(`Failed to update session: ${ex}`));
                    }

                    return {
                        "auth-token": Buffer.from(":" + session.launchTokenId).toString("base64")
                    };
                },
                options: {
                    auth: false
                }
            }
        );
    }
};
