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
    Session = require("../lib/session");

module.exports = {
    name: "catapult-player-api-routes-v1-sessions",
    register: (server, options) => {
        server.route(
            [
                {
                    method: "GET",
                    path: "/session/{id}",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        const result = await Session.load(req.params.id, req.auth.credentials.tenantId, {db: req.server.app.db});

                        if (! result) {
                            return Boom.notFound();
                        }

                        return result;
                    }
                },

                {
                    method: "POST",
                    path: "/session/{id}/abandon",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        const sessionId = req.params.id,
                            tenantId = req.auth.credentials.tenantId,
                            db = req.server.app.db,
                            lrsWreck = Wreck.defaults(await req.server.methods.lrsWreckDefaults(req));

                        await Session.abandon(sessionId, tenantId, "api", {db, lrsWreck});
                        return null;
                    }
                }
            ]
        );
    }
};
