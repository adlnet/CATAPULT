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

const fs = require("fs"),
    util = require("util"),
    Boom = require("@hapi/boom"),
    Wreck = require("@hapi/wreck"),
    { v4: uuidv4 } = require("uuid");

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
                            code = uuidv4();

                        let insertResult;

                        try {
                            insertResult = await db.insert(
                                {
                                    tenant_id: 1,
                                    code,
                                    course_id: req.payload.courseId,
                                    actor: JSON.stringify(req.payload.actor)
                                }
                            ).into("registrations");
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed to insert into registrations: ${ex}`));
                        }

                        return db.first("*").from("registrations").where("id", insertResult);
                    }
                },

                {
                    method: "GET",
                    path: "/registration/{id}",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        const result = await req.server.app.db.first("*").from("registrations").where("id", req.params.id);

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
                        const deleteResult = await req.server.app.db("registrations").where("id", req.params.id).delete();

                        return null;
                    }
                }
            ]
        );
    }
};
