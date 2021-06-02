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
    Boom = require("@hapi/boom");


module.exports = {
    create: async ({tenantId, courseId, actor, code = uuidv4()}, {db}) => {
        let registrationId;

        try {
            await db.transaction(
                async (trx) => {
                    const courseAUs = await trx.select("*").from("courses_aus").where({tenantId, courseId});

                    registrationId = await trx("registrations").insert(
                        {
                            tenantId,
                            code,
                            courseId,
                            actor: JSON.stringify(actor),
                            metadata: JSON.stringify({
                                version: 1
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
                                    version: 1
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
    }
};
