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

const Joi = require("joi"),
    Boom = require("@hapi/boom"),
    Jwt = require("@hapi/jwt"),
    { v4: uuidv4 } = require("uuid");

module.exports = {
    name: "catapult-player-api-routes-v1-mgmt",
    register: (server, options) => {
        server.route(
            [
                {
                    method: "GET",
                    path: "/ping",
                    options: {
                        tags: ["api"]
                    },
                    handler: (req, h) => ({
                        ok: true
                    })
                },
                {
                    method: "GET",
                    path: "/about",
                    options: {
                        tags: ["api"]
                    },
                    handler: (req, h) => ({
                        tenantId: req.auth.credentials.tenantId,
                        description: "catapult-player-service"
                    })
                },
                {
                    method: "POST",
                    path: "/tenant",
                    options: {
                        auth: "basic",
                        tags: ["api"],
                        validate: {
                            payload: Joi.object({
                                code: Joi.string().required()
                            }).required().label("Request-Tenant")
                        }
                    },
                    handler: async (req, h) => {
                        const tenant = {
                            code: req.payload.code
                        };

                        try {
                            const insertResult = await req.server.app.db("tenants").insert(tenant);

                            tenant.id = insertResult[0];
                        }
                        catch (ex) {
                            // TODO: could check what message is returned and provide 409 when tenant already exists
                            throw Boom.internal(`Failed to insert tenant: ${ex}`);
                        }

                        return tenant;
                    }
                },
                {
                    method: "DELETE",
                    path: "/tenant/{id}",
                    options: {
                        auth: "basic",
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        const tenantId = req.params.id;

                        try {
                            await req.server.app.db("tenants").where({id: tenantId}).delete();
                        }
                        catch (ex) {
                            throw new Boom.internal(`Failed to delete tenant (${tenantId}): ${ex}`);
                        }

                        return null;
                    }
                },
                {
                    method: "POST",
                    path: "/auth",
                    options: {
                        auth: "basic",
                        tags: ["api"],
                        validate: {
                            payload: Joi.object({
                                tenantId: Joi.number().required(),
                                audience: Joi.string().required()
                            }).required().label("Request-Auth")
                        }
                    },
                    handler: async (req, h) => {
                        const tenantId = req.payload.tenantId;

                        let queryResult;

                        try {
                            queryResult = await req.server.app.db.first("id").from("tenants").where({id: tenantId});
                        }
                        catch (ex) {
                            throw Boom.internal(`Failed to select to confirm tenant: ${ex}`);
                        }

                        if (! queryResult) {
                            throw Boom.notFound(`Unknown tenant: ${tenantId}`);
                        }

                        const token = Jwt.token.generate(
                            {
                                iss: req.server.app.jwt.iss,
                                aud: `${req.server.app.jwt.audPrefix}${req.payload.audience}`,
                                sub: tenantId,
                                jti: uuidv4()
                            },
                            req.server.app.jwt.tokenSecret
                        );

                        return {
                            token
                        };
                    }
                }
            ]
        );
    }
};
