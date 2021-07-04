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

const Bcrypt = require("bcrypt"),
    Boom = require("@hapi/boom"),
    AUTH_TTL_SECONDS = require("../../../lib/consts.js").AUTH_TTL_SECONDS,
    getClientSafeUser = (user) => {
        delete user.password;
        delete user.playerKey;
        delete user.playerSecret;

        return user;
    };

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
                {
                    method: "GET",
                    path: "/login",
                    options: {
                        auth: {
                            mode: "try"
                        },
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        if (! req.auth.isAuthenticated) {
                            return h.response().code(401);
                        }

                        let user;

                        try {
                            user = await req.server.app.db.first("*").from("users").queryContext({jsonCols: ["roles"]}).where({id: req.auth.credentials.id});
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed to retrieve user for id ${req.auth.credentials.id}: ${ex}`));
                        }
                        // Restore whatever the current cookie's expiration is at, for use in managing client side logged in state.
                        user.expiresAt = req.state.sid.expiresAt;

                        return getClientSafeUser(user);
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
                        tags: ["api"]
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
                }
            ]
        );
    }
};
