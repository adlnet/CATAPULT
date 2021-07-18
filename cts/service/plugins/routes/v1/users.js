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
    Hoek = require("@hapi/hoek"),
    Joi = require("joi"),
    User = require("./lib/user"),
    isAdmin = (req) => {
        if (req.auth.credentials.roles.includes("admin")) {
            return;
        }

        throw Boom.forbidden("Not an admin");
    },
    getClientSafeUser = (user) => {
        const safe = Hoek.clone(user);

        delete safe.tenantId;
        delete safe.password;
        delete safe.playerApiToken;

        return safe;
    };

module.exports = {
    name: "catapult-cts-api-routes-v1-users",
    register: (server, options) => {
        server.route(
            [
                {
                    method: "POST",
                    path: "/users",
                    options: {
                        tags: ["api"],
                        validate: {
                            payload: Joi.object({
                                username: Joi.string().required(),
                                password: Joi.string().required(),
                                roles: Joi.array().optional()
                            }).required().label("Request-PostUser")
                        }
                    },
                    handler: async (req, h) => {
                        isAdmin(req);

                        const {userId, tenantId} = await User.create(req.payload.username, req.payload.password, req.payload.roles, {req}),
                            result = await req.server.app.db.first("*").from("users").queryContext({jsonCols: ["roles"]}).where({id: userId});

                        return getClientSafeUser(result);
                    }
                },

                {
                    method: "GET",
                    path: "/users",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        isAdmin(req);

                        const db = req.server.app.db,
                            users = await db.select( "*").from("users").queryContext({jsonCols: ["roles"]}).orderBy("created_at", "desc");

                        return {
                            items: users.map(getClientSafeUser)
                        };
                    }
                },

                {
                    method: "GET",
                    path: "/users/{id}",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        isAdmin(req);

                        const result = await req.server.app.db.first("*").from("users").queryContext({jsonCols: ["roles"]}).where({id: req.params.id});

                        if (! result) {
                            return Boom.notFound();
                        }

                        return getClientSafeUser(result);
                    }
                },

                {
                    method: "DELETE",
                    path: "/users/{id}",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        isAdmin(req);

                        if (Number.parseInt(req.params.id) === req.auth.credentials.id) {
                            throw Boom.forbidden("Can't delete self");
                        }

                        await User.delete(req.params.id, {req});

                        return null;
                    }
                }
            ]
        );
    }
};
