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
    Wreck = require("@hapi/wreck"),
    Jwt = require("@hapi/jwt");

module.exports = {
    create: async (username, password, roles = [], {req}) => {
        //
        // need to create a tenant in the player
        //
        let createTenantResponse,
            createTenantResponseBody;

        let auth = await req.server.methods.playerBasicAuthHeader(req);
        let tenantURL = `${req.server.app.player.baseUrl}/api/v1/tenant`;

        try {
            createTenantResponse = await Wreck.request(
                "POST",
                tenantURL,
                {
                    headers: {
                        Authorization: auth
                    },
                    payload: {
                        code: username
                    }
                }
            );
            createTenantResponseBody = await Wreck.read(createTenantResponse, {json: true});
        }
        catch (ex) {
            throw Boom.internal(new Error(`Failed request to create player tenant: ${ex}`));
        }

        if (createTenantResponse.statusCode !== 200) {
            throw Boom.internal(new Error(`Failed to create player tenant (${createTenantResponse.statusCode}): ${createTenantResponseBody.message}${createTenantResponseBody.srcError ? " (" + createTenantResponseBody.srcError + ")" : ""}`));
        }

        const playerTenantId = createTenantResponseBody.id;

        //
        // with the tenant created get a token for this user to use
        // to access the player API for that tenant
        //
        let createTokenResponse,
            createTokenResponseBody;

        try {
            createTokenResponse = await Wreck.request(
                "POST",
                `${req.server.app.player.baseUrl}/api/v1/auth`,
                {
                    headers: {
                        Authorization: await req.server.methods.playerBasicAuthHeader(req)
                    },
                    payload: {
                        tenantId: playerTenantId,
                        audience: `cts-${username}`
                    }
                }
            );
            createTokenResponseBody = await Wreck.read(createTokenResponse, {json: true});
        }
        catch (ex) {
            throw Boom.internal(new Error(`Failed request to create player tenant: ${ex}`));
        }

        if (createTokenResponse.statusCode !== 200) {
            throw Boom.internal(new Error(`Failed to retrieve player token (${createTokenResponse.statusCode}): ${createTokenResponseBody.message}${createTokenResponseBody.srcError ? " (" + createTokenResponseBody.srcError + ")" : ""}`));
        }

        const playerApiToken = createTokenResponseBody.token;

        let userId,
            tenantId;

        await req.server.app.db.transaction(
            async (txn) => {
                //
                // create a tenant for this user
                //
                try {
                    const insertResult = await txn.insert(
                        {
                            code: `user-${username}`,
                            playerTenantId
                        }
                    ).into("tenants");

                    tenantId = insertResult[0];
                }
                catch (ex) {
                    throw new Error(`Failed to insert tenant: ${ex}`);
                }

                //
                // finally create the user which contains the token needed to access
                // the player API
                //
                try {
                    const insertResult = await txn.insert(
                        {
                            tenantId,
                            username: username,
                            password: await Bcrypt.hash(password, 8),
                            playerApiToken,
                            roles: JSON.stringify([
                                "user",
                                ...roles
                            ])
                        }
                    ).into("users");

                    userId = insertResult[0];
                }
                catch (ex) {
                    throw Boom.internal(new Error(`Failed to insert into users: ${ex}`));
                }
            }
        );

        return {userId, tenantId};
    },

    delete: async (id, {req}) => {
        const db = req.server.app.db,
            user = await db.first("*").from("users").where({id}),
            token = Jwt.token.decode(user.playerApiToken),
            playerTenantId = token.decoded.payload.sub;

        let deleteTenantResponse;

        try {
            deleteTenantResponse = await Wreck.request(
                "DELETE",
                `${req.server.app.player.baseUrl}/api/v1/tenant/${playerTenantId}`,
                {
                    headers: {
                        Authorization: await req.server.methods.playerBasicAuthHeader(req)
                    }
                }
            );
        }
        catch (ex) {
            throw Boom.internal(new Error(`Failed request to delete player tenant: ${ex}`));
        }

        if (deleteTenantResponse.statusCode !== 204) {
            const deleteTenantResponseBody = await Wreck.read(deleteTenantResponse, {json: true});

            throw Boom.internal(new Error(`Failed to delete player tenant (${deleteTenantResponse.statusCode}): ${deleteTenantResponseBody.message}${deleteTenantResponseBody.srcError ? " (" + deleteTenantResponseBody.srcError + ")" : ""}`));
        }

        try {
            await db("users").where({id: req.params.id}).delete();
        }
        catch (ex) {
            throw Boom.internal(new Error(`Failed to delete user from database: ${ex}`));
        }

        try {
            await db("tenants").where({playerTenantId}).delete();
        }
        catch (ex) {
            throw Boom.internal(new Error(`Failed to delete tenant from database: ${ex}`));
        }
    }
};
