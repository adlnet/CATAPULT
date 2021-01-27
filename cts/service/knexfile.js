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
const waitPort = require("wait-port"),
    {
        MYSQL_HOST: HOST = "rdbms",
        MYSQL_HOST_FILE: HOST_FILE,
        DATABASE_USER: USER = "catapult",
        DATABASE_USER_FILE: USER_FILE,
        DATABASE_USER_PASSWORD: PASSWORD = "quartz",
        DATABASE_USER_PASSWORD_FILE: PASSWORD_FILE,
        DATABASE_NAME: DB = "catapult_player",
        DATABASE_NAME_FILE: DB_FILE,
    } = process.env;

module.exports = async () => {
    const host = HOST_FILE ? fs.readFileSync(HOST_FILE) : HOST,
        user = USER_FILE ? fs.readFileSync(USER_FILE) : USER,
        password = PASSWORD_FILE ? fs.readFileSync(PASSWORD_FILE) : PASSWORD,
        database = DB_FILE ? fs.readFileSync(DB_FILE) : DB;

    await waitPort({host, port: 3306});

    return {
        client: "mysql",
        connection: {host, user, password, database}
    };
};
