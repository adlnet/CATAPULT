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
const tableName = "registrations_courses_aus";

exports.up = (knex) => knex.schema.createTable(
    tableName,
    (table) => {
        table.increments("id");
        table.timestamp("created_at").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.timestamp("updated_at").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"));
        table.integer("tenant_id").unsigned().notNullable().references("id").inTable("tenants").onUpdate("CASCADE").onDelete("RESTRICT");

        table.integer("course_au_id").unsigned().notNullable().references("id").inTable("courses_aus").onUpdate("CASCADE").onDelete("CASCADE");
        table.integer("registration_id").unsigned().notNullable().references("id").inTable("registrations").onUpdate("CASCADE").onDelete("CASCADE");

        table.boolean("has_been_attempted").notNullable().default(false);
        table.boolean("has_been_browsed").notNullable().default(false);
        table.boolean("has_been_reviewed").notNullable().default(false);
        table.integer("duration_normal").unsigned();
        table.integer("duration_browse").unsigned();
        table.integer("duration_review").unsigned();
        table.boolean("is_passed").notNullable().default(false);
        table.boolean("is_completed").notNullable().default(false);
        table.boolean("is_waived").notNullable().default(false);
        table.string("waived_reason");

        // is_satisfied here is used to track when an AU was already satisfied
        table.boolean("is_satisfied").notNullable().default(false);

        table.json("metadata").notNullable();
    }
);
exports.down = (knex) => knex.schema.dropTable(tableName);
