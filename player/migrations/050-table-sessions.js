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
const tableName = "sessions";

exports.up = (knex) => knex.schema.createTable(
    tableName,
    (table) => {
        table.increments("id");
        table.timestamp("created_at").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
        table.timestamp("updated_at").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"));
        table.integer("tenant_id").unsigned().notNullable().references("id").inTable("tenants").onUpdate("CASCADE").onDelete("RESTRICT");

        table.integer("registrations_courses_aus_id").unsigned().notNullable().references("id").inTable("registrations_courses_aus").onUpdate("CASCADE").onDelete("CASCADE");

        table.string("code").notNullable().unique();
        table.datetime("last_request_time");

        table.enum("launch_mode", ["Normal", "Browse", "Review"]).notNullable();
        table.float("mastery_score");
        table.json("context_template").notNullable();
        table.uuid("launch_token_id").notNullable();
        table.boolean("launch_token_fetched").notNullable().default(false);
        table.boolean("launch_data_fetched").notNullable().default(false);
        table.boolean("learner_prefs_fetched").notNullable().default(false);
        table.boolean("is_launched").notNullable().default(false);
        table.boolean("is_initialized").notNullable().default(false);
        table.timestamp("initialized_at");
        table.boolean("is_completed").notNullable().default(false);
        table.boolean("is_passed").notNullable().default(false);
        table.boolean("is_failed").notNullable().default(false);
        table.boolean("is_terminated").notNullable().default(false);
        table.boolean("is_abandoned").notNullable().default(false);
        table.enum("abandoned_by", ["new-launch", "api"]);
        table.integer("duration_normal").unsigned();
        table.integer("duration_browse").unsigned();
        table.integer("duration_review").unsigned();
    }
);
exports.down = (knex) => knex.schema.dropTable(tableName);
