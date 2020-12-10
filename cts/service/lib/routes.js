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

const { v4: uuidv4 } = require("uuid");

module.exports = [
    //
    // serve the static web client files
    //
    {
        method: "GET",
        path: "/client/{param*}",
        handler: {
            directory: {
                path: `${__dirname}/../../client/dist`,
                listing: true
            }
        }
    },

    /*
     * System Management
     *
     */
    {
        method: "GET",
        path: "/api/ping",
        handler: (req, h) => ({
            ok: true
        })
    },
    {
        method: "GET",
        path: "/api/about",
        handler: (req, h) => ({
            description: "catapult-cts-service"
        })
    },

    /*
     * Handle `/` to help web UI users get to `/client/`
     */
    {
        method: "GET",
        path: "/client",
        handler: (req, h) => h.redirect("/client/")
    },
    {
        method: "GET",
        path: "/",
        handler: (req, h) => h.redirect("/client/")
    }
];
