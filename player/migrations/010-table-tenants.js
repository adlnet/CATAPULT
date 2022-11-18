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
const tableName = "tenants";
const defaultTenantName = process.env.FIRST_TENANT_NAME;

exports.up = async (knex) => {
    await knex.schema.createTable(
        tableName,
        (table) => {
            table.increments("id");
            table.timestamp("created_at").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
            table.timestamp("updated_at").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"));
            table.string("code").notNullable().unique();
        }
    );
    //Check to see if there is a value in First_tenant_name
    if(defaultTenantName){
    //On creating new database, create new tenant, will automatically be '1'
     await knex(tableName).insert({code: defaultTenantName})
      .then( function (result) {
          console.log("First tenant created named " + defaultTenantName) });// respond back to request
    }
    else{
        console.log("There is no specified default tenant name. No default tenant created.")
    }
};
exports.down = (knex) => knex.schema.dropTable(tableName);
