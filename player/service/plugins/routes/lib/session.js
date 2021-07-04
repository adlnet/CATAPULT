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

const Boom = require("@hapi/boom");

module.exports = {
    loadForChange: async (txn, sessionId, tenantId) => {
        let queryResult;

        try {
            queryResult = await txn
                .first("*")
                .from("sessions")
                .leftJoin("registrations_courses_aus", "sessions.registrations_courses_aus_id", "registrations_courses_aus.id")
                .leftJoin("registrations", "registrations_courses_aus.registration_id", "registrations.id")
                .leftJoin("courses_aus", "registrations_courses_aus.course_au_id", "courses_aus.id")
                .where(
                    {
                        "sessions.tenant_id": tenantId
                    }
                )
                .andWhere(function () {
                    this.where("sessions.id", sessionId).orWhere("sessions.code", sessionId);
                })
                .queryContext(
                    {
                        jsonCols: [
                            "registrations_courses_aus.metadata",
                            "registrations.actor",
                            "registrations.metadata",
                            "courses_aus.metadata",
                            "sessions.context_template"
                        ]
                    }
                )
                .forUpdate()
                .options({nestTables: true})
        }
        catch (ex) {
            txn.rollback();
            throw new Error(`Failed to select session, registration course AU, registration and course AU for update: ${ex}`);
        }

        if (! queryResult) {
            txn.rollback();
            throw Boom.notFound(`session: ${sessionId}`);
        }

        const {
            sessions: session,
            registrationsCoursesAus: regCourseAu,
            registrations: registration,
            coursesAus: courseAu
        } = queryResult;

        regCourseAu.courseAu = courseAu;

        return {session, regCourseAu, registration, courseAu};
    }
};
