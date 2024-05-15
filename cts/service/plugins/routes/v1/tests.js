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
    Hoek = require("@hapi/hoek"),
    Joi = require("joi"),
    { v4: uuidv4 } = require("uuid"),
    iri = require("iri"),

    // sessions is optional because we know calling this from registration creation
    // will never have any sessions
    getClientSafeReg = (registration, playerResponseBody, sessionsByAu = []) => {
        const result = Hoek.clone(registration);

        delete result.playerId;

        result.metadata.actor = playerResponseBody.actor;
        result.metadata.isSatisfied = playerResponseBody.isSatisfied;
        result.metadata.moveOn = playerResponseBody.metadata.moveOn;
        result.metadata.aus = playerResponseBody.aus;

        let pending = 0,
            notStarted = 0,
            conformant = 0,
            nonConformant = 0;

        result.metadata.aus.forEach(
            (au, index) => {
                if (sessionsByAu[index] && sessionsByAu[index].some((session) => session.metadata.violatedReqIds.length > 0)) {
                    au.result = "non-conformant";
                    nonConformant += 1;
                }
                else if (au.hasBeenAttempted && au.isSatisfied && ! au.isWaived) {
                    au.result = "conformant";
                    conformant += 1;
                }
                else if (au.hasBeenAttempted) {
                    au.result = "pending";
                    pending += 1;
                }
                else {
                    au.result = "not-started";
                    notStarted += 1;
                }
            }
        );

        if (! pending && ! notStarted && ! nonConformant) {
            result.metadata.result = "conformant";
        }
        else if (nonConformant) {
            result.metadata.result = "non-conformant";
        }
        else if (pending || conformant) {
            result.metadata.result = "pending";
        }
        else {
            result.metadata.result = "not-started";
        }

        return result;
    };

module.exports = {
    name: "catapult-cts-api-routes-v1-tests",
    register: (server, options) => {
        server.decorate(
            "toolkit",
            "registrationEvent",
            async (registrationId, tenantId, db, rawData) => {
                try {
                    await db.insert(
                        {
                            tenantId,
                            registrationId,
                            metadata: JSON.stringify({
                                version: 1,
                                ...rawData
                            })
                        }
                    ).into("registrations_logs");
                }
                catch (ex) {
                    console.log(`Failed to write to registrations_logs (${registrationId}): ${ex}`);
                }
            }
        );

        server.route(
            [
                //
                // not proxying this request because have to alter the body based on
                // converting the CTS course id to the stored Player course id
                //
                {
                    method: "POST",
                    path: "/tests",
                    options: {
                        tags: ["api"],
                        validate: {
                            payload: Joi.object({
                                courseId: Joi.number().min(0).required(),
                                actor: Joi.object({
                                    account: Joi.object({
                                        name: Joi.string().required(),
                                        homePage: Joi.string().required().custom((value, helpers) => {
                                            try {
                                                new iri.IRI(value).toAbsolute();
                                            }
                                            catch (ex) {
                                                throw new Error("account homepage must be a valid IRI");
                                            }

                                            return value;
                                        })
                                    }).required(),
                                    objectType: Joi.any().allow("Agent").optional(),
                                    name: Joi.string().optional()
                                }).required()
                            }).required().label("Request-PostTest")
                        }
                    },
                    handler: async (req, h) => {
                        const db = req.server.app.db,
                            tenantId = req.auth.credentials.tenantId;

                        let course;

                        try {
                            course = await db.first("*").from("courses").queryContext({jsonCols: ["metadata"]}).where({tenantId, id: req.payload.courseId});
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed to retrieve course for id ${req.payload.courseId}: ${ex}`));
                        }

                        if (! course) {
                            throw Boom.notFound(`course: ${req.payload.courseId}`);
                        }

                        let createResponse,
                            createResponseBody;

                        try {
                            createResponse = await Wreck.request(
                                "POST",
                                `${req.server.app.player.baseUrl}/api/v1/registration`,
                                {
                                    headers: {
                                        Authorization: await req.server.methods.playerBearerAuthHeader(req)
                                    },
                                    payload: {
                                        courseId: course.playerId,
                                        actor: req.payload.actor
                                    }
                                }
                            );
                            createResponseBody = await Wreck.read(createResponse, {json: true});
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed request to create player registration: ${ex}`));
                        }

                        if (createResponse.statusCode !== 200) {
                            throw Boom.internal(new Error(`Failed to create player registration (${createResponse.statusCode}): ${createResponseBody.message}${createResponseBody.srcError ? " (" + createResponseBody.srcError + ")" : ""}`));
                        }
                        
                        // Create an Agent Profile for this new user.
                        //
                        let lrsWreck = Wreck.defaults(await req.server.methods.lrsWreckDefaults(req));
                        let profileCreationRes = await lrsWreck.request(
                            "POST",
                            "agents/profile?" + new URLSearchParams(
                                {
                                    profileId: "cmi5LearnerPreferences",
                                    agent: JSON.stringify(req.payload.actor)
                                }
                            ).toString(),
                            {
                                payload: {
                                    languagePreference: "en-US,fr-FR,fr-BE",
                                    audiePreference: "on"
                                }
                            }
                        )
                            .catch(err => console.error("Failed to Create Agent Profile", profileCreationRes.statusCode, err));

                        const txn = await db.transaction();
                        let registrationId;

                        try {
                            const insertResult = await txn.insert(
                                {
                                    tenantId,
                                    playerId: createResponseBody.id,
                                    code: createResponseBody.code,
                                    courseId: req.payload.courseId,
                                    metadata: JSON.stringify({
                                        version: 1,

                                        // storing these locally because they are used to build
                                        // the list of tests
                                        actor: createResponseBody.actor,
                                        result: "not-started"
                                    })
                                }
                            ).into("registrations");

                            registrationId = insertResult[0];
                        }
                        catch (ex) {
                            await txn.rollback();
                            throw Boom.internal(new Error(`Failed to insert into registrations: ${ex}`));
                        }

                        await h.registrationEvent(
                            registrationId,
                            tenantId,
                            txn,
                            {
                                kind: "api",
                                resource: "registration:create",
                                registrationId,
                                registrationCode: createResponseBody.code,
                                summary: `Registration Created`
                            }
                        );

                        const result = await txn.first("*").from("registrations").where({id: registrationId, tenantId}).queryContext({jsonCols: ["metadata"]});

                        await txn.commit();

                        return getClientSafeReg(result, createResponseBody);
                    }
                },

                {
                    method: "GET",
                    path: "/tests/{id}",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        const db = req.server.app.db,
                            id = req.params.id,
                            tenantId = req.auth.credentials.tenantId,
                            registrationFromSelect = await db.first("*").from("registrations").where({id, tenantId}).queryContext({jsonCols: ["metadata"]});

                        if (! registrationFromSelect) {
                            return Boom.notFound();
                        }

                        let response,
                            responseBody;

                        try {
                            response = await Wreck.request(
                                "GET",
                                `${req.server.app.player.baseUrl}/api/v1/registration/${registrationFromSelect.playerId}`,
                                {
                                    headers: {
                                        Authorization: await req.server.methods.playerBearerAuthHeader(req)
                                    }
                                }
                            );
                            responseBody = await Wreck.read(response, {json: true});
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed request to player to get registration details: ${ex}`));
                        }

                        if (response.statusCode !== 200) {
                            throw Boom.internal(new Error(`Failed to get player registration details (${response.statusCode}): ${responseBody.message}${responseBody.srcError ? " (" + responseBody.srcError + ")" : ""}`));
                        }

                        const sessions = await db.select("id", "au_index", "metadata").from("sessions").where({registrationId: id, tenantId}).queryContext({jsonCols: ["metadata"]}).orderBy("au_index"),
                            sessionsByAu = [];

                        for (const session of sessions) {
                            sessionsByAu[session.auIndex] = sessionsByAu[session.auIndex] || [];
                            sessionsByAu[session.auIndex].push(session);
                        }

                        const currentCachedResult = registrationFromSelect.metadata.result,
                            registration = getClientSafeReg(registrationFromSelect, responseBody, sessionsByAu);

                        //
                        // check to see if the test result determined from the newly updated player
                        // response is different than the one currently cached in the metadata, if it
                        // it then update it
                        //
                        if (registration.metadata.result !== registrationFromSelect.metadata.result) {
                            try {
                                await db("registrations").update({metadata: JSON.stringify(registration.metadata)}).where({id, tenantId});
                            }
                            catch (ex) {
                                throw Boom.internal(new Error(`Failed to update registration metadata: ${ex}`));
                            }
                        }

                        return registration;
                    }
                },

                {
                    method: "GET",
                    path: "/tests/{id}/logs",
                    options: {
                        tags: ["api"]
                    },
                    handler: async (req, h) => {
                        const tenantId = req.auth.credentials.tenantId,
                            db = req.server.app.db;

                        let registrationLogs;

                        try {
                            registrationLogs = await db
                                .select("*")
                                .from("registrations_logs")
                                .queryContext({jsonCols: ["metadata"]})
                                .where({tenantId, registrationId: req.params.id})
                                .orderBy("created_at");
                        }
                        catch (ex) {
                            throw Boom.internal(`Failed to select registration logs: ${ex}`);
                        }

                        return registrationLogs;
                    }
                },

                {
                    method: "POST",
                    path: "/tests/{id}/waive-au/{auIndex}",
                    options: {
                        tags: ["api"],
                        payload: {
                            parse: true
                        },
                        validate: {
                            payload: Joi.object({
                                reason: Joi.string().required()
                            }).label("Request-WaiveAU")
                        }
                    },
                    handler: async (req, h) => {
                        const db = req.server.app.db,
                            registrationId = req.params.id,
                            auIndex = req.params.auIndex,
                            tenantId = req.auth.credentials.tenantId,
                            reason = req.payload.reason,
                            result = await db.first("*").from("registrations").where({tenantId, id: registrationId});

                        if (! result) {
                            return Boom.notFound();
                        }

                        let waiveResponse,
                            waiveResponseBody;

                        try {
                            waiveResponse = await Wreck.request(
                                "POST",
                                `${req.server.app.player.baseUrl}/api/v1/registration/${result.playerId}/waive-au/${auIndex}`,
                                {
                                    headers: {
                                        Authorization: await req.server.methods.playerBearerAuthHeader(req)
                                    },
                                    payload: {
                                        reason
                                    }
                                }
                            );
                            waiveResponseBody = await Wreck.read(waiveResponse, {json: true});
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed request to player to waive AU: ${ex}`));
                        }

                        if (waiveResponse.statusCode !== 204) {
                            throw Boom.internal(new Error(`Failed to waive AU in player registration (${waiveResponse.statusCode}): ${waiveResponseBody.message}${waiveResponseBody.srcError ? " (" + waiveResponseBody.srcError + ")" : ""}`));
                        }

                        await h.registrationEvent(registrationId, tenantId, db, {kind: "spec", auIndex, reason, resource: "registration:waive-au", summary: `Waived (${auIndex})`});

                        return null;
                    }
                },

                {
                    method: "GET",
                    path: "/tests/{id}/learner-prefs",
                    options: {
                        tags: ["api"],
                        cors: {
                            additionalExposedHeaders: ["Etag"]
                        }
                    },
                    handler: async (req, h) => {
                        const db = req.server.app.db,
                            registrationId = req.params.id,
                            tenantId = req.auth.credentials.tenantId,
                            registration = await db.first("*").from("registrations").where({tenantId, id: registrationId});

                        if (! registration) {
                            return Boom.notFound();
                        }

                        let response,
                            responseBody;

                        try {
                            response = await Wreck.request(
                                "GET",
                                `${req.server.app.player.baseUrl}/api/v1/registration/${registration.playerId}/learner-prefs`,
                                {
                                    headers: {
                                        Authorization: await req.server.methods.playerBearerAuthHeader(req)
                                    }
                                }
                            );
                            responseBody = await Wreck.read(response, {json: true});
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed request to player to get learner preferences: ${ex}`));
                        }

                        if (response.statusCode !== 200 && response.statusCode !== 404) {
                            throw Boom.internal(new Error(`Failed to request learner preferences from player (${response.statusCode}): ${responseBody.message}${responseBody.srcError ? " (" + responseBody.srcError + ")" : ""}`));
                        }

                        const result = h.response(responseBody);

                        result.code(response.statusCode);
                        result.message(response.statusMessage);
                        result.header("Etag", response.headers.etag);

                        return result;
                    }
                },

                {
                    method: "POST",
                    path: "/tests/{id}/learner-prefs",
                    options: {
                        tags: ["api"],
                        cors: {
                            additionalHeaders: ["If-Match"]
                        },
                        payload: {
                            parse: true
                        },
                        validate: {
                            payload: Joi.object({
                                languagePreference: Joi.string().pattern(/^[-A-Za-z0-9]+(?:,[-A-Za-z0-9]+)*$/).required(),
                                audioPreference: Joi.string().allow("on", "off").required()
                            }).label("Request-PostLearnerPrefs")
                        }
                    },
                    handler: async (req, h) => {
                        const db = req.server.app.db,
                            registrationId = req.params.id,
                            tenantId = req.auth.credentials.tenantId,
                            registration = await db.first("*").from("registrations").where({tenantId, id: registrationId});

                        if (! registration) {
                            return Boom.notFound();
                        }

                        let response,
                            responseBody;

                        try {
                            response = await Wreck.request(
                                "POST",
                                `${req.server.app.player.baseUrl}/api/v1/registration/${registration.playerId}/learner-prefs`,
                                {
                                    headers: {
                                        Authorization: await req.server.methods.playerBearerAuthHeader(req),
                                        "Content-Type": "application/json",
                                        ...req.headers["if-match"] ? {"If-Match": req.headers["if-match"]} : {},
                                        ...req.headers["if-none-match"] ? {"If-None-Match": req.headers["if-none-match"]} : {}
                                    },
                                    payload: req.payload
                                }
                            );
                            responseBody = await Wreck.read(response, {json: true});
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed request to player to save learner preferences: ${ex}`));
                        }

                        if (response.statusCode !== 204) {
                            throw Boom.internal(new Error(`Failed to save learner preferences in player (${response.statusCode}): ${responseBody.message}${responseBody.srcError ? " (" + responseBody.srcError + ")" : ""}`));
                        }

                        return null;
                    }
                },

                {
                    method: "DELETE",
                    path: "/tests/{id}/learner-prefs",
                    options: {
                        tags: ["api"],
                        cors: {
                            additionalHeaders: ["If-Match"]
                        }
                    },
                    handler: async (req, h) => {
                        const db = req.server.app.db,
                            registrationId = req.params.id,
                            tenantId = req.auth.credentials.tenantId,
                            registration = await db.first("*").from("registrations").where({tenantId, id: registrationId});

                        if (! registration) {
                            return Boom.notFound();
                        }

                        let response,
                            responseBody;

                        try {
                            response = await Wreck.request(
                                "DELETE",
                                `${req.server.app.player.baseUrl}/api/v1/registration/${registration.playerId}/learner-prefs`,
                                {
                                    headers: {
                                        Authorization: await req.server.methods.playerBearerAuthHeader(req),
                                        ...req.headers["if-match"] ? {"If-Match": req.headers["if-match"]} : {}
                                        // ...req.headers["if-none-match"] ? {"If-None-Match": req.headers["if-none-match"]} : {}
                                    }
                                }
                            );
                            responseBody = await Wreck.read(response, {json: true});
                        }
                        catch (ex) {
                            throw Boom.internal(new Error(`Failed request to player to delete learner preferences: ${ex}`));
                        }

                        if (response.statusCode !== 204) {
                            throw Boom.internal(new Error(`Failed to delete learner preferences in player (${response.statusCode}): ${responseBody.message}${responseBody.srcError ? " (" + responseBody.srcError + ")" : ""}`));
                        }

                        return null;
                    }
                }
            ]
        );
    }
};
