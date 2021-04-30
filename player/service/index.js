/*
    Copyright 2020 Rustici Software

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

const Hapi = require("@hapi/hapi"),
    H2o2 = require("@hapi/h2o2"),
    Inert = require("@hapi/inert"),
    Vision = require("@hapi/vision"),
    AuthBasic = require("@hapi/basic"),
    Bcrypt = require("bcrypt"),
    waitPort = require("wait-port"),
    {
        LRS_ENDPOINT,
        LRS_USERNAME,
        LRS_PASSWORD,
        CONTENT_URL
    } = process.env;

const provision = async () => {
    const server = Hapi.server(
            {
                host: process.argv[3],
                port: process.argv[2] || 3398,
                routes: {
                    cors: true,
                    response: {
                        emptyStatusCode: 204
                    }
                }
            }
        ),
        sigHandler = async (signal) => {
            try {
                const db = server.app.db;

                await server.stop({timeout: 10000});

                await db.destroy();

                console.log(`Catapult player service stopped (${signal})`);
                process.exit(0);
            }
            catch (ex) {
                console.log(`Catapult player service failed to stop gracefully (${signal}): terminating the process`, ex);
                process.exit(1);
            }
        };

    await waitPort({host: "rdbms", port: 3306});

    const db = await require("./lib/db")();

    server.app = {
        contentUrl: CONTENT_URL || "http://localhost:3398/content",
        lrs: {
            endpoint: LRS_ENDPOINT,
            username: LRS_USERNAME,
            password: LRS_PASSWORD
        },
        db
    };

    server.ext(
        "onPreResponse",
        (req, h) => {
            if (req.response.isBoom) {
                req.response.output.payload.srcError = req.response.message;
            }

            return h.continue;
        }
    );

    await server.register(H2o2);
    await server.register(Inert);
    await server.register(AuthBasic);

    await server.register(
        [
            Vision,
            {
                plugin: require("hapi-swagger"),
                options: {
                    basePath: "/api/v1",
                    pathPrefixSize: 3,
                    info: {
                        title: "Catapult Player API"
                    }
                }
            }
        ]
    );

    server.method(
        "basicAuthValidate",
        async (req, key, secret) => {
            const credential = await req.server.app.db.first("*").from("credentials").where({key});

            if (! credential) {
                return {isValid: false, credentials: null};
            }

            if (! await Bcrypt.compare(secret, credential.secret)) {
                return {isValid: false, credentials: null};
            }

            return {
                isValid: true,
                credentials: {
                    id: credential.id,
                    tenantId: credential.tenantId
                }
            };
        },
        {
            generateKey: (req, key, secret) => `${key}-${secret}`,
            cache: {
                expiresIn: 60000,
                generateTimeout: 5000
            }
        }
    );

    server.auth.strategy(
        "basic",
        "basic",
        {
            validate: async (req, key, secret) => await req.server.methods.basicAuthValidate(req, key, secret)
        }
    );

    await server.register(
        [
            require("./plugins/routes/content"),
            require("./plugins/routes/lrs"),
            require("./plugins/routes/spec")
        ]
    );

    server.auth.default(
        {
            strategies: ["basic"]
        }
    );
    await server.register(
        [
            require("./plugins/routes/v1/mgmt"),
            require("./plugins/routes/v1/courses"),
            require("./plugins/routes/v1/registrations")
        ],
        {
            routes: {
                prefix: "/api/v1"
            }
        }
    );

    await server.start();

    process.on("SIGINT", sigHandler);
    process.on("SIGTERM", sigHandler);

    console.log("Catapult player service running on %s", server.info.uri);
};

process.on(
    "unhandledRejection",
    (err) => {
        console.log(err);
        process.exit(1);
    }
);

provision();
