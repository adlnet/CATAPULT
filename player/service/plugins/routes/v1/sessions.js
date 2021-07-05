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
    { v4: uuidv4 } = require("uuid"),
    Session = require("../lib/session");

module.exports = {
    name: "catapult-player-api-routes-v1-sessions",
    register: (server, options) => {
        server.route(
            [
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
                            lrsWreck = Wreck.defaults(await req.server.methods.lrsWreckDefaults(req)),
                            txn = await db.transaction();
                        let session,
                            regCourseAu,
                            registration,
                            courseAu;

                        try {
                            ({
                                session,
                                regCourseAu,
                                registration,
                                courseAu
                            } = await Session.loadForChange(txn, sessionId, tenantId));
                        }
                        catch (ex) {
                            txn.rollback();
                            throw Boom.internal(ex);
                        }

                        if (session.is_terminated) {
                            txn.rollback();
                            throw Boom.conflict(new Error("Session is terminated"));
                        }
                        if (session.is_abandoned) {
                            txn.rollback();
                            throw Boom.conflict(new Error("Session already abandoned"));
                        }

                        let duration = "PT0S",
                            stResponse,
                            stResponseBody;

                        try {
                            stResponse = await lrsWreck.request(
                                "POST",
                                "statements",
                                {
                                    headers: {
                                        "Content-Type": "application/json"
                                    },
                                    payload: {
                                        id: uuidv4(),
                                        timestamp: new Date().toISOString(),
                                        actor: registration.actor,
                                        verb: {
                                            id: "https://w3id.org/xapi/adl/verbs/abandoned",
                                            display: {
                                                en: "abandoned"
                                            }
                                        },
                                        object: {
                                            id: regCourseAu.courseAu.lms_id
                                        },
                                        result: {
                                            duration
                                        },
                                        context: {
                                            registration: registration.code,
                                            extensions: {
                                                "https://w3id.org/xapi/cmi5/context/extensions/sessionid": session.code
                                            },
                                            contextActivities: {
                                                category: [
                                                    {
                                                        id: "https://w3id.org/xapi/cmi5/context/categories/cmi5"
                                                    }
                                                ]
                                            }
                                        }
                                    }
                                }
                            );

                            stResponseBody = await Wreck.read(stResponse, {json: true});
                        }
                        catch (ex) {
                            txn.rollback();
                            throw Boom.internal(new Error(`Failed request to store abandoned statement: ${ex}`));
                        }

                        if (stResponse.statusCode !== 200) {
                            txn.rollback();
                            throw Boom.internal(new Error(`Failed to store abandoned statement (${stResponse.statusCode}): ${stResponseBody}`));
                        }

                        try {
                            await txn("sessions").update({is_abandoned: true}).where({id: session.id, tenantId});
                        }
                        catch (ex) {
                            txn.rollback();
                            throw Boom.internal(`Failed to update session: ${ex}`);
                        }

                        txn.commit();

                        return null;
                    }
                }
            ]
        );
    }
};
