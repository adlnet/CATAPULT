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
        satisfied: false,
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

module.exports = {
    create: async ({tenantId, courseId, actor, code = uuidv4()}, {db}) => {
        let registrationId;

        try {
            await db.transaction(
                async (trx) => {
                    const course = await trx.first("*").from("courses").queryContext({jsonCols: ["metadata", "structure"]}).where({tenantId, id: courseId}),
                        courseAUs = await trx.select("*").from("courses_aus").queryContext({jsonCols: ["metadata"]}).where({tenantId, courseId});

                    registrationId = await trx("registrations").insert(
                        {
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
                        }
                    );

                    await trx("registrations_courses_aus").insert(
                        courseAUs.map(
                            (ca) => ({
                                tenantId,
                                registrationId,
                                course_au_id: ca.id,
                                metadata: JSON.stringify({
                                    version: 1,
                                    moveOn: ca.metadata.moveOn
                                })
                            })
                        )
                    );
                }
            );
        }
        catch (ex) {
            throw Boom.internal(new Error(`Failed to store registration: ${ex}`));
        }

        return registrationId;
    },

    load: async ({tenantId, registrationId}, {db}) => {
        return db.first("*").queryContext({jsonCols: ["actor", "metadata"]}).from("registrations").where(
            {
                tenantId,
                id: registrationId
            }
        );
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
                    this.where("registrations.id", registrationId).orWhere("registrations.code", registrationId);
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
            txn.rollback();
            throw new Error(`Failed to select registration course AU, registration and course AU for update: ${ex}`);
        }

        if (! queryResult) {
            txn.rollback();
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
