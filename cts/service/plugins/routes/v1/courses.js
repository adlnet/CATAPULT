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

const { v4: uuidv4 } = require("uuid");

module.exports = {
    name: "catapult-api-routes-v1-courses",
    register: (server, options) => {
        server.route(
            [
                {
                    method: "GET",
                    path: "/courses",
                    handler: async (req, h) => ({
                        items: await req.server.app.db.select("*").from("courses")
                    })
                },

                {
                    method: "POST",
                    path: "/courses",
                    options: {
                        payload: {
                            parse: false,
                            allow: "application/zip"
                        }
                    },
                    handler: async (req, h) => {
                        const id = uuidv4(),
                            insertResult = await req.server.app.db.insert(
                                {
                                    tenant_id: 1,
                                    code: id,
                                    title: `Uploaded Course: ${id}`
                                }
                            ).into("courses");

                        console.log(`POST /courses - inserted ${id}`);

                        return req.server.app.db.select("*").from("courses").where("id", insertResult);
                    }
                },

                {
                    method: "DELETE",
                    path: "/courses/{id}",
                    handler: async (req, h) => {
                        const result = await req.server.app.db("courses").where("id", req.params.id).delete();

                        console.log(`POST /courses - deleted ${req.params.id}`);

                        return null;
                    }
                }
            ]
        );
    }
};
