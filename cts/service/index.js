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
    AuthCookie = require("@hapi/cookie"),
    Bcrypt = require("bcrypt"),
    waitPort = require("wait-port"),
    { AUTH_TTL_SECONDS } = require("./lib/consts"),
    {
        PLAYER_BASE_URL: PLAYER_BASE_URL = "http://player:3398",
        PLAYER_KEY,
        PLAYER_SECRET,
        LRS_ENDPOINT,
        LRS_USERNAME,
        LRS_PASSWORD
    } = process.env;

const provision = async () => {
    const server = Hapi.server(
            {
                host: process.argv[3],
                port: process.argv[2] || 3399,
                routes: {
                    cors: {
                        credentials: true
                    },
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

                console.log(`Catapult CTS service stopped (${signal})`);
                process.exit(0);
            }
            catch (ex) {
                console.log(`Catapult CTS service failed to stop gracefully (${signal}): terminating the process`, ex);
                process.exit(1);
            }
        };

    const DB_HOST = (process.env.DB_HOST || "rdbms");
    await waitPort({host: DB_HOST, port: 3306});

    const db = await require("./lib/db")();

    server.app = {
        player: {
            baseUrl: PLAYER_BASE_URL,
            key: PLAYER_KEY,
            secret: PLAYER_SECRET
        },
        db
    };

    server.ext(
        "onPreResponse",
        (req, h) => {
            if (req.response.isBoom) {
                if (req.response.output.statusCode === 500) {
                    req.response.output.payload.srcError = req.response.message;
                }
            }

            return h.continue;
        }
    );

    await server.register(H2o2);
    await server.register(Inert);
    await server.register(AuthBasic);
    await server.register(AuthCookie);

    await server.register(
        [
            Vision,
            {
                plugin: require("hapi-swagger"),
                options: {
                    basePath: "/api/v1",
                    pathPrefixSize: 3,
                    info: {
                        title: "Catapult CTS API"
                    }
                }
            }
        ]
    );

    server.method(
        "lrsWreckDefaults",
        (req) => ({
            baseUrl: LRS_ENDPOINT.endsWith("/") ? LRS_ENDPOINT : LRS_ENDPOINT + "/",
            headers: {
                "X-Experience-API-Version": (process.env.LRS_XAPI_VERSION ||  "1.0.3"),
                Authorization: `Basic ${Buffer.from(`${LRS_USERNAME}:${LRS_PASSWORD}`).toString("base64")}`
            },
            json: true
        }),
        {
            generateKey: (req) => `${LRS_ENDPOINT}-${LRS_USERNAME}-${LRS_PASSWORD}`,
            cache: {
                expiresIn: 60000,
                generateTimeout: 1000
            }
        }
    );

    server.method(
        "getCredentials",
        (user) => {
            const expiresAt = new Date();

            expiresAt.setSeconds(expiresAt.getSeconds() + AUTH_TTL_SECONDS);

            return {
                id: user.id,
                tenantId: user.tenantId,
                username: user.username,
                roles: user.roles,
                expiresAt
            };
        },
        {
            generateKey: (user) => user.id.toString(),
            cache: {
                expiresIn: 60000,
                generateTimeout: 1000
            }
        }
    );
    server.method(
        "basicAuthValidate",
        async (req, username, password) => {
            const user = await req.server.app.db.first("*").from("users").queryContext({jsonCols: ["roles"]}).where({username});

            if (! user) {
                return {isValid: false, credentials: null};
            }

            if (! await Bcrypt.compare(password, user.password)) {
                return {isValid: false, credentials: null};
            }

            return {
                isValid: true,
                credentials: await req.server.methods.getCredentials(user)
            };
        },
        {
            generateKey: (req, username, password) => `${username}-${password}`,
            cache: {
                expiresIn: 60000,
                generateTimeout: 5000
            }
        }
    );
    server.method(
        "cookieAuthValidateFunc",
        async (req, session) => {
            const user = await req.server.app.db.first("id").from("users").where({id: session.id, username: session.username});

            if (! user) {
                return {valid: false};
            }

            return {valid: true};
        },
        {
            generateKey: (req, session) => session.id.toString(),
            cache: {
                expiresIn: 60000,
                generateTimeout: 5000
            }
        }
    );
    server.method(
        "playerBearerAuthHeader",
        async (req) => {
            const user = await req.server.app.db.first("player_api_token").from("users").where({id: req.auth.credentials.id});

            if (! user) {
                throw Boom.unauthorized(`Unrecognized user: ${req.auth.credentials.id}`);
            }

            return `Bearer ${user.playerApiToken}`;
        }
    );
    server.method(
        "playerBasicAuthHeader",
        (req) => `Basic ${Buffer.from(`${req.server.app.player.key}:${req.server.app.player.secret}`).toString("base64")}`,
        {
            generateKey: (req) => `${req.server.app.player.key}-${req.server.app.player.secret}`,
            cache: {
                expiresIn: 60000,
                generateTimeout: 1000
            }
        }
    );

    server.auth.strategy(
        "basic",
        "basic",
        {
            validate: async (req, username, password) => await req.server.methods.basicAuthValidate(req, username, password)
        }
    );
    server.auth.strategy(
        "session",
        "cookie",
        {
            validateFunc: async (req, session) => await req.server.methods.cookieAuthValidateFunc(req, session),
            cookie: {
                password: Date.now() + process.env.CTS_SESSION_COOKIE_PASSWORD + Math.ceil(Math.random() * 10000000),

                // switch to use via https
                isSecure: false,

                ttl: AUTH_TTL_SECONDS * 1000
            }
        }
    );

    await server.register(
        [
            require("./plugins/routes/client"),
        ]
    );
    server.route(
        {
            method: "GET",
            path: "/",
            handler: (req, h) => h.redirect("/client/"),
            options: {
                auth: false
            }
        }
    );

    //
    // order matters here, specifying the default auth setup then applies to
    // the rest of the routes registered from this point
    //
    server.auth.default(
        {
            strategies: ["basic", "session"]
        }
    );
    await server.register(
        [
            require("./plugins/routes/v1/core"),
            require("./plugins/routes/v1/mgmt"),
            require("./plugins/routes/v1/courses"),
            require("./plugins/routes/v1/tests"),
            require("./plugins/routes/v1/sessions"),
            require("./plugins/routes/v1/users")
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

    console.log("Catapult CTS service running on %s", server.info.uri);
};

process.on(
    "unhandledRejection",
    (err) => {
        console.log(err);
        process.exit(1);
    }
);

provision();
