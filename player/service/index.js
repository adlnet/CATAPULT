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
    AuthJwt = require("@hapi/jwt"),
    waitPort = require("wait-port"),
    {
        LRS_ENDPOINT,
        LRS_USERNAME,
        LRS_PASSWORD,
        CONTENT_URL,
        TOKEN_SECRET,
        API_KEY,
        API_SECRET,
        PLAYER_API_ROOT
    } = process.env;

const rootPath = (process.env.PLAYER_API_ROOT || "");

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

    let lrsEndpoint = LRS_ENDPOINT;
    
    if (!lrsEndpoint.endsWith("/")) {
        lrsEndpoint += "/";
    }
    console.log("What is the lrs endpoint here? is the  added???  " + lrsEndpoint);
    server.app = {
        contentUrl: CONTENT_URL || "http://localhost:3398/content",
        lrs: {
            endpoint: lrsEndpoint,
            username: LRS_USERNAME,
            password: LRS_PASSWORD
        },
       
        db,
        jwt: {
            tokenSecret: TOKEN_SECRET,
            iss: "urn:catapult:player",
            audPrefix: "urn:catapult:"
        }
    };

    server.ext(
        "onPreResponse",
        (req, h) => {
            if (req.response.isBoom) {
                if (req.response.data && req.response.data.violatedReqId) {
                    req.response.output.payload.violatedReqId = req.response.data.violatedReqId;
                }

                if (req.response.output.statusCode === 500) {
                    req.response.output.payload.srcError = req.response.message;
                }
            }

            return h.continue;
        }
    );

    let defaultRouteArgs = {
        routes: !rootPath ? undefined : {
            prefix: rootPath
        }
    };

    await server.register(H2o2, {...defaultRouteArgs});
    await server.register(Inert, {...defaultRouteArgs});
    await server.register(AuthJwt, {...defaultRouteArgs});
    await server.register(AuthBasic, {...defaultRouteArgs});

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
        ],
        {...defaultRouteArgs}
    );

    //
    // this is only used to authenticate the route that is used
    // to create tenants and get API access tokens
    //
    server.method(
        "basicAuthValidate",
        async (req, key, secret) => {

            if (key !== API_KEY || secret !== API_SECRET) {
                return {isValid: false, credentials: null};
            }

            return {
                isValid: true,
                credentials: {}
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

    // tried making this just return the Wreck object, that didn't work correctly
    // probably because of the cache
    server.method(
        "lrsWreckDefaults",
        (req) => ({
            baseUrl: req.server.app.lrs.endpoint,
            headers: {
                "X-Experience-API-Version": "1.0.3",
                Authorization: `Basic ${Buffer.from(`${req.server.app.lrs.username}:${req.server.app.lrs.password}`).toString("base64")}`
            },
            json: true
        }),
        {
            generateKey: (req) => `${req.server.app.lrs.endpoint}-${req.server.app.lrs.username}-${req.server.app.lrs.password}`,
            cache: {
                expiresIn: 60000,
                generateTimeout: 1000
            }
        }
    );

    server.auth.strategy(
        "jwt",
        "jwt",
        {
            keys: server.app.jwt.tokenSecret,
            verify: {
                aud: new RegExp(`^${server.app.jwt.audPrefix}.+$`),
                iss: server.app.jwt.iss,
                sub: false
            },
            validate: async (artifacts, req) => {
                return {
                    isValid: true,
                    credentials: {
                        tenantId: artifacts.decoded.payload.sub
                    }
                };
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
        ],
        {...defaultRouteArgs}
    );

    server.auth.default(
        {
            strategies: ["jwt"]
        }
    );
    await server.register(
        [
            require("./plugins/routes/v1/mgmt"),
            require("./plugins/routes/v1/courses"),
            require("./plugins/routes/v1/registrations"),
            require("./plugins/routes/v1/sessions")
        ],
        {
            routes: {
                prefix: rootPath + "/api/v1"
            }
        }
    );

    server.route({
        method: '*',
        path: '/{any*}',
        handler: function (request, h) {
            
            let usingBasePath = !!rootPath;
            if (usingBasePath && !request.path.startsWith(rootPath)) {
                let prefixed = rootPath + request.path;
                return h.redirect(prefixed);
            }

            return h.response('404 Error! Page Not Found!').code(404);
        }
    });

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
