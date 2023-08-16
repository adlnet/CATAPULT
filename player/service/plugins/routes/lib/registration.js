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

const { v4: uuidv4 } = require("uuid"),
    Boom = require("@hapi/boom"),
    Wreck = require("@hapi/wreck"),
    mapMoveOnChildren = (child) => ({
        lmsId: child.lmsId,
        pubId: child.id,
        type: child.type,
        satisfied: (child.type === "au" && child.moveOn === "NotApplicable"),
        ...(child.type === "block" ? {children: child.children.map(mapMoveOnChildren)} : {})
    }),
    isSatisfied = async (node, {auToSetSatisfied, satisfiedStTemplate, lrsWreck}) => {
        if (node.satisfied) {
            return true;
        }

        if (node.type === "au") {
            if (node.lmsId === auToSetSatisfied) {
                node.satisfied = true;
            }
            return node.satisfied;
        }

        // recursively check all children to see if they are satisfied
        let allChildrenSatisfied = true;

        for (const child of node.children) {
            if (! await isSatisfied(child, {auToSetSatisfied, satisfiedStTemplate, lrsWreck})) {
                allChildrenSatisfied = false;
            }
        }

        if (allChildrenSatisfied) {
            node.satisfied = true;

            let statement;

            try {
                statement = JSON.parse(satisfiedStTemplate);
            }
            catch (ex) {
                throw new Error(`Failed to parse statement template: ${ex}`);
            }

            statement.id = uuidv4();
            statement.timestamp = new Date().toISOString();
            statement.object = {
                id: node.lmsId,
                definition: {
                    type: node.type === "block" ? "https://w3id.org/xapi/cmi5/activitytype/block" : "https://w3id.org/xapi/cmi5/activitytype/course"
                }
            };
            statement.context.contextActivities.grouping = [
                {
                    id: node.pubId
                }
            ];

            let satisfiedStResponse,
                satisfiedStResponseBody;

            try {
                satisfiedStResponse = await lrsWreck.request(
                    "POST",
                    "statements",
                    {
                        headers: {
                            "Content-Type": "application/json"
                        },
                        payload: statement
                    }
                );

                satisfiedStResponseBody = await Wreck.read(satisfiedStResponse, {json: true});
            }
            catch (ex) {
                throw new Error(`Failed request to store satisfied statement: ${ex}`);
            }

            if (satisfiedStResponse.statusCode !== 200) {
                throw new Error(`Failed to store satisfied statement: ${satisfiedStResponse.statusCode} (${satisfiedStResponseBody})`);
            }

            return true;
        }

        return false;
    };
let Registration;

module.exports = Registration = {
    create: async ({tenantId, courseId, actor, code = uuidv4()}, {db, lrsWreck}) => {
        let registrationId;

        try {
            await db.transaction(
                async (txn) => {
                    const course = await txn.first("*").from("courses").queryContext({jsonCols: ["metadata", "structure"]}).where({tenantId, id: courseId}),
                        courseAUs = await txn.select("*").from("courses_aus").queryContext({jsonCols: ["metadata"]}).where({tenantId, courseId}),
                        registration = {
                            tenantId,
                            code,
                            courseId,
                            actor: JSON.stringify(actor),
                            metadata: JSON.stringify({
                                version: 1,
                                moveOn: {
                                    type: "course",
                                    lmsId: course.lmsId,
                                    pubId: course.structure.course.id,
                                    satisfied: false,
                                    children: course.structure.course.children.map(mapMoveOnChildren)
                                }
                            })
                        },
                        regResult = await txn("registrations").insert(registration);

                    registrationId = registration.id = regResult[0];

                    await txn("registrations_courses_aus").insert(
                        courseAUs.map(
                            (ca) => ({
                                tenantId,
                                registrationId,
                                course_au_id: ca.id,
                                metadata: JSON.stringify({
                                    version: 1,
                                    moveOn: ca.metadata.moveOn
                                }),
                                is_satisfied: ca.metadata.moveOn === "NotApplicable"
                            })
                        )
                    );

                    try {
                        registration.actor = JSON.parse(registration.actor);
                        registration.metadata = JSON.parse(registration.metadata);

                        await Registration.interpretMoveOn(
                            registration,
                            {
                                sessionCode: uuidv4(),
                                lrsWreck
                            }
                        );
                    }
                    catch (ex) {
                        throw new Error(`Failed to interpret moveOn: ${ex}`);
                    }

                    try {
                        await txn("registrations").update({metadata: JSON.stringify(registration.metadata)}).where({tenantId, id: registration.id});
                    }
                    catch (ex) {
                        throw new Error(`Failed to update registration metadata: ${ex}`);
                    }
                }
            );
        }
        catch (ex) {
            console.error("Failed to create registration: ", ex);
            throw Boom.internal(new Error(`Failed to store registration: ${ex}`));
        }

        return registrationId;
    },

    load: async ({tenantId, registrationId}, {db, loadAus = true}) => {
        let registration;

        try {
            registration = await db
                .first("*")
                .queryContext({jsonCols: ["actor", "metadata"]})
                .from("registrations")
                .where(
                    {
                        tenantId
                    }
                ).andWhere(
                    function () {
                        this.where("id", registrationId).orWhere("code", registrationId.toString());
                    }
                );
        }
        catch (ex) {
            throw new Error(`Failed to load registration: ${ex}`);
        }

        if (loadAus) {
            try {
                registration.aus = await db
                    .select(
                        "has_been_attempted",
                        "duration_normal",
                        "duration_browse",
                        "duration_review",
                        "is_passed",
                        "is_completed",
                        "is_waived",
                        "waived_reason",
                        "is_satisfied",
                        "metadata"
                    )
                    .from("registrations_courses_aus")
                    .where({tenantId, registrationId: registration.id})
                    .queryContext({jsonCols: ["metadata"]});
            }
            catch (ex) {
                throw new Error(`Failed to load registration AUs: ${ex}`);
            }
        }

        return registration;
    },

    loadAuForChange: async (txn, registrationId, auIndex, tenantId) => {
        let queryResult;

        try {
            queryResult = await txn
                .first("*")
                .from("registrations_courses_aus")
                .leftJoin("registrations", "registrations_courses_aus.registration_id", "registrations.id")
                .leftJoin("courses_aus", "registrations_courses_aus.course_au_id", "courses_aus.id")
                .where(
                    {
                        "registrations_courses_aus.tenant_id": tenantId,
                        "courses_aus.au_index": auIndex
                    }
                )
                .andWhere(function () {
                    this.where("registrations.id", registrationId).orWhere("registrations.code", registrationId.toString());
                })
                .queryContext(
                    {
                        jsonCols: [
                            "registrations_courses_aus.metadata",
                            "registrations.actor",
                            "registrations.metadata",
                            "courses_aus.metadata"
                        ]
                    }

                )
                .forUpdate()
                .options({nestTables: true})
        }
        catch (ex) {
            await txn.rollback();
            throw new Error(`Failed to select registration course AU, registration and course AU for update: ${ex}`);
        }

        if (! queryResult) {
            await txn.rollback();
            throw Boom.notFound(`registration: ${registrationId}`);
        }

        const {
            registrationsCoursesAus: regCourseAu,
            registrations: registration,
            coursesAus: courseAu
        } = queryResult;

        regCourseAu.courseAu = courseAu;

        return {regCourseAu, registration, courseAu};
    },

    interpretMoveOn: async (registration, {auToSetSatisfied, sessionCode, lrsWreck}) => {
        const moveOn = registration.metadata.moveOn,

            //
            // use a stringified value as the template which allows for parsing
            // on the other end to allow easy cloning to allow use of the template
            // for multiple satisfied statements in the case of blocks in a course
            // and nested blocks
            //
            satisfiedStTemplate = JSON.stringify({
                actor: registration.actor,
                verb: {
                    id: "https://w3id.org/xapi/adl/verbs/satisfied",
                    display: {
                        "en": "satisfied"

                    }
                },
                context: {
                    registration: registration.code,
                    contextActivities: {
                        category: [
                            {
                                id: "https://w3id.org/xapi/cmi5/context/categories/cmi5"
                            }
                        ],
                        grouping: []
                    },
                    extensions: {
                        "https://w3id.org/xapi/cmi5/context/extensions/sessionid": sessionCode
                    }
                }
            });

        if (moveOn.satisfied) {
            return;
        }

        await isSatisfied(moveOn, {auToSetSatisfied, lrsWreck, satisfiedStTemplate});
    }
};
