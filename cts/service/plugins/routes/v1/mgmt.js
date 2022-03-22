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
    name: "catapult-cts-api-routes-v1-mgmt",
    register: (server, options) => {
        server.route(
            {
                method: "GET",
                path: "/ping",
                options: {
                    tags: ["api"]
                },
                handler: (req, h) => ({
                    ok: true
                })
            },
            {
                method: "GET",
                path: "/about",
                options: {
                    tags: ["api"]
                },
                handler: (req, h) => ({
                    description: "catapult-cts-service"
                })
            }
        );
    }
};
