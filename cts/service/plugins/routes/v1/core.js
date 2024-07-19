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

const ALLOWED_ORIGIN = (process.env.HOSTNAME || "*");

const Bcrypt = require("bcrypt"),
    Joi = require("joi"),
    Boom = require("@hapi/boom"),
    User = require("./lib/user"),
    { AUTH_TTL_SECONDS } = require("../../../lib/consts"),
    getClientSafeUser = (user) => {
        delete user.password;
        delete user.playerApiToken;
        delete user.tenantId;

        return user;
    };

let alreadyBootstrapped = false;

module.exports = {
    name: "catapult-cts-api-routes-v1-core",
    register: (server, options) => {
        server.route(
            [
                //
                // this route is mainly used to check whether or not a cookie provides for valid
                // authentication, and in the case it does it will return information about the
                // user which allows for automatic login in the web UI client
                //
                // it also acts as the initial request whenever the UI is loaded so use it to
                // check to make sure the site has been initialized and that at least one user
                // exists
                //
                {
                    method: "GET",
                    path: "/login",
                    options: {
                        auth: {
                            mode: "try"
                        },
                        tags: ["api"],
                        security: true,
                        cors: {
                            origin: [ALLOWED_ORIGIN]
                        }
                    },
                    handler: async (req, h) => {
                        const db = req.server.app.db,
                            responseBody = {};
                        let responseStatus;

                        if (req.auth.isAuthenticated) {
                            responseStatus = 200;

                            let user;

                            try {
                                user = await db.first("*").from("users").queryContext({jsonCols: ["roles"]}).where({id: req.auth.credentials.id});
                            }
                            catch (ex) {
                                throw Boom.internal(new Error(`Failed to retrieve user for id ${req.auth.credentials.id}: ${ex}`));
                            }

                            responseBody.isBootstrapped = true;
                            responseBody.user = getClientSafeUser(user);

                            // Restore whatever the current cookie's expiration is at, for use in managing client side logged in state.
                            if (req.state.sid) {
                                responseBody.user.expiresAt = req.state.sid.expiresAt;
                            }
                        }
                        else {
                            responseStatus = 401;

                            //
                            // check to make sure there is at least one user in the users table
                            //
                            const [query] = await db("users").count("id", {as: "count"});

                            responseBody.isBootstrapped = query.count > 0;
                        }

                        return h.response(responseBody).code(responseStatus);
                    }
                },

                //
                // this route allows authenticating by username/password and then optionally
                // provides a cookie to prevent the need to continue to use basic auth
                //
                {
                    method: "POST",
                    path: "/login",
                    options: {
                        auth: false,
                        tags: ["api"],
                        validate: {
                            payload: Joi.object({
                                username: Joi.string().required(),
                                password: Joi.string().required(),
                                storeCookie: Joi.boolean().optional()
                            }).label("Request-Login")
                        },
                        security: true,
                        cors: {
                            origin: [ALLOWED_ORIGIN]
                        }
                    },
                    handler: async (req, h) => {
                        let user;

                        try {
                            user = await req.server.app.db.first("*").from("users").queryContext({jsonCols: ["roles"]}).where({username: req.payload.username});
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed to retrieve user for username ${req.payload.username}: ${ex}`));
                        }

                        if (! user || ! await Bcrypt.compare(req.payload.password, user.password)) {
                            throw Boom.unauthorized();
                        }

                        const expiresAt = new Date();
                        expiresAt.setSeconds(expiresAt.getSeconds() + AUTH_TTL_SECONDS)
                        user.expiresAt = expiresAt.toISOString();

                        if (req.payload.storeCookie) {
                            req.cookieAuth.set(await req.server.methods.getCredentials(user));
                        }

                        return getClientSafeUser(user);
                    }
                },

                //
                // this route simply removes any previously stored auth cookie
                //
                {
                    method: "GET",
                    path: "/logout",
                    options: {
                        auth: false,
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        req.cookieAuth.clear();

                        return null;
                    }
                },

                //
                // this route is used to establish the first user in the database and can't
                // be accessed once users exist in the DB, it is intended to make it easy
                // to establish deployments that are unique to few users
                //
                {
                    method: "POST",
                    path: "/bootstrap",
                    options: {
                        tags: ["api"],
                        auth: false,
                        validate: {
                            payload: Joi.object({
                                firstUser: Joi.object({
                                    username: Joi.string().required(),
                                    password: Joi.string().required()
                                }).required()
                            }).label("Request-Bootstrap")
                        }
                    },
                    handler: async (req, h) => {

                        if (!alreadyBootstrapped) {

                            //
                            // checking that there aren't any users created yet is effectively
                            // the authorization for this resource
                            //
                            const db = req.server.app.db;
                            const [query] = await db("users").count("id", {as: "count"});

                            if (query.count > 0) {
                                alreadyBootstrapped = true;
                            }
                        }

                        if (alreadyBootstrapped) {
                            throw Boom.badRequest(`This endpoint cannot be used once the system has been initialized.`);
                        }

                        try {
                            // the first user has to be an admin so they can handle other users being created
                            await User.create(req.payload.firstUser.username, req.payload.firstUser.password, ["admin"], {req});
                        }
                        catch (ex) {
                            throw Boom.internal(`Failed to create bootstrap user.`);
                        }

                        return null;
                    }
                }
            ]
        );
    }
};
