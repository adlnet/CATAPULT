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

const DB_HOST = (process.env.DB_HOST || "rdbms");
const DB_NAME = (process.env.DB_NAME || "catapult_player");
const DB_USERNAME = (process.env.DB_USERNAME || "catapult");
const DB_PASSWORD = (process.env.DB_PASSWORD || "quartz");

const Hoek = require("@hapi/hoek"),
    waitPort = require("wait-port"),
    {
        // MYSQL_HOST: HOST = "rdbms",
        MYSQL_HOST_FILE: HOST_FILE,
        // DATABASE_USER: USER = "catapult",
        DATABASE_USER_FILE: USER_FILE,
        // DATABASE_USER_PASSWORD: DB_PASSWORD,
        DATABASE_USER_PASSWORD_FILE: PASSWORD_FILE,
        // DATABASE_NAME: DB = "catapult_player",
        DATABASE_NAME_FILE: DB_FILE,
    } = process.env;

module.exports = async () => {
    // const host = HOST_FILE ? fs.readFileSync(HOST_FILE) : HOST,
    //     user = USER_FILE ? fs.readFileSync(USER_FILE) : USER,
    //     password = PASSWORD_FILE ? fs.readFileSync(PASSWORD_FILE) : PASSWORD,
    //     database = DB_FILE ? fs.readFileSync(DB_FILE) : DB;
    const host = HOST_FILE ? fs.readFileSync(HOST_FILE) : DB_HOST,
        user = USER_FILE ? fs.readFileSync(USER_FILE) : DB_USERNAME,
        password = PASSWORD_FILE ? fs.readFileSync(PASSWORD_FILE) : DB_PASSWORD,
        database = DB_FILE ? fs.readFileSync(DB_FILE) : DB_NAME;
    

    await waitPort({host, port: 3306});

    return {
        client: "mysql",
        connection: {host, user, password, database},
        postProcessResponse: (result, queryContext) => {
            if (result && queryContext && queryContext.jsonCols) {
                if (Array.isArray(result)) {
                    result = result.map(
                        (row) => {
                            for (const k of queryContext.jsonCols) {
                                const parts = k.split(".");
                                let match = row,
                                    field = k;

                                if (parts.length > 1) {
                                    field = parts[parts.length - 1];
                                    match = Hoek.reach(row, parts.slice(0, -1).join("."));
                                }

                                try {
                                    match[field] = JSON.parse(match[field]);
                                }
                                catch (ex) {
                                    throw new Error(`Failed to parse JSON in key ('${k}' in '${row}'): ${ex}`);
                                }
                            }

                            return row;
                        }
                    );
                }
                else {
                    for (const k of queryContext.jsonCols) {
                        const parts = k.split(".");

                        let match = result,
                            field = k;

                        if (parts.length > 1) {
                            field = parts[parts.length - 1];
                            match = Hoek.reach(result, parts.slice(0, -1).join("."));
                        }

                        try {
                            match[field] = JSON.parse(match[field]);
                        }
                        catch (ex) {
                            throw new Error(`Failed to parse JSON in key ('${k}' in '${result}'): ${ex}`);
                        }
                    }
                }
            }

            return result;
        }

    };
};
