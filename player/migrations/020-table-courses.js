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
const tableName = "courses";

exports.up = (knex) => knex.schema.createTable(
    tableName,
    (table) => {
        table.increments("id");
        table.integer("tenant_id").unsigned().references("id").inTable("tenants").onUpdate("CASCADE").onDelete("RESTRICT");
        table.string("lms_id").notNullable().unique();

        table.json("metadata").notNullable();
        table.json("structure").notNullable();
    }
);
exports.down = (knex) => knex.schema.dropTable(tableName);
