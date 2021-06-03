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
    Registration = require("./lib/registration");

module.exports = {
    name: "catapult-player-api-routes-v1-registrations",
    register: (server, options) => {
        server.route(
            [
                {
                    method: "POST",
                    path: "/registration",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        const db = req.server.app.db,
                            registrationId = await Registration.create(
                                {
                                    tenantId: req.auth.credentials.tenantId,
                                    courseId: req.payload.courseId,
                                    actor: req.payload.actor
                                },
                                {db}
                            );

                        return db.first("*").from("registrations").where("id", registrationId);
                    }
                },

                {
                    method: "GET",
                    path: "/registration/{id}",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        const result = await Registration.load({tenantId: req.auth.credentials.tenantId, registrationId: req.params.id}, {db: req.server.app.db});

                        if (! result) {
                            return Boom.notFound();
                        }

                        return result;
                    }
                },

                {
                    method: "DELETE",
                    path: "/registration/{id}",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        const tenantId = req.auth.credentials.tenantId,
                            deleteResult = await req.server.app.db("registrations").where({tenantId, "id": req.params.id}).delete();

                        return null;
                    }
                },

                {
                    method: "POST",
                    path: "/registration/{id}/waive-au/{auIndex}",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        throw new Error(`Not implemented, waive AU`);
                    }
                }
            ]
        );
    }
};
