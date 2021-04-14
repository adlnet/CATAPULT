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

module.exports = {
    name: "catapult-cts-api-routes-client",
    register: (server, options) => {
        server.route(
            [
                //
                // serve the static web client files
                //
                {
                    method: "GET",
                    path: "/client/{param*}",
                    handler: {
                        directory: {
                            path: `${__dirname}/../../client`,
                            listing: true
                        }
                    },
                    options: {
                        auth: false
                    }
                },

                //
                // Handle `/` to help web UI users get to `/client/`
                //
                {
                    method: "GET",
                    path: "/client",
                    handler: (req, h) => h.redirect("/client/"),
                    options: {
                        auth: false
                    }
                }
            ]
        );
    }
};
