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

const fs = require("fs"),
    util = require("util"),
    Boom = require("@hapi/boom"),
    Wreck = require("@hapi/wreck"),
    xml2js = require("xml2js"),
    { v4: uuidv4 } = require("uuid"),
    readFile = util.promisify(fs.readFile),
    validateAU = (element) => {
        const result = {
            type: "au",
            id: element.$.id
        };

        if (element.title && element.title.length > 0) {
            result.title = element.title[0].langstring.map(
                (ls) => ({
                    lang: ls.$.lang,
                    text: ls._
                })
            );
        }
        if (element.description && element.description.length > 0) {
            result.description = element.description[0].langstring.map(
                (ls) => ({
                    lang: ls.$.lang,
                    text: ls._
                })
            );
        }

        return result;
    },
    validateBlock = (element) => {
        const result = {
            type: "block",
            id: element.$.id,
            children: []
        };

        if (element.title && element.title.length > 0) {
            result.title = element.title[0].langstring.map(
                (ls) => ({
                    lang: ls.$.lang,
                    text: ls._
                })
            );
        }
        if (element.description && element.description.length > 0) {
            result.description = element.description[0].langstring.map(
                (ls) => ({
                    lang: ls.$.lang,
                    text: ls._
                })
            );
        }

        for (const child of element.$$) {
            if (child["#name"] === "au") {
                result.children.push(
                    validateAU(child)
                );
            }
            else if (child["#name"] === "block") {
                result.children.push(
                    validateBlock(child)
                );
            }
            else if (child["#name"] === "objectives") {
            }
            else {
                console.log("Unrecognized element: ", element);
            }
        }

        return result;
    },
    validateAndReduceStructure = (structure) => {
        const result = {
            course: {
                type: "course",
                children: [],
                objectives: null
            }
        };

        if (! structure.courseStructure) {
            throw new Error(`No "courseStructure" element`);
        }

        const _course = structure.courseStructure.course[0];

        result.course.id = _course.$.id;

        if (_course.title && _course.title.length > 0) {
            result.course.title = _course.title[0].langstring.map(
                (ls) => ({
                    lang: ls.$.lang,
                    text: ls._
                })
            );
        }
        if (_course.description && _course.description.length > 0) {
            result.course.description = _course.description[0].langstring.map(
                (ls) => ({
                    lang: ls.$.lang,
                    text: ls._
                })
            );
        }

        for (const element of structure.courseStructure.$$) {
            // have already handled the course element
            if (element["#name"] === "course") {
                continue;
            }
            // objectives is a single static list
            else if (element["#name"] === "objectives") {
            }
            else if (element["#name"] === "au") {
                result.course.children.push(
                    validateAU(element)
                );
            }
            else if (element["#name"] === "block") {
                result.course.children.push(
                    validateBlock(element)
                );
            }
            else {
                throw new Error(`Unrecognized element: ${element["#name"]}`);
            }
        }

        return result;
    };

module.exports = {
    name: "catapult-player-api-routes-v1-courses",
    register: (server, options) => {
        server.route(
            [
                {
                    method: "POST",
                    path: "/course",
                    options: {
                        payload: {
                            allow: [
                                "application/zip",
                                "application/xml"
                            ],
                            output: "file"
                        }
                    },
                    handler: async (req, h) => {
                        const db = req.server.app.db,
                            lmsId = `http://catapult/${uuidv4()}`,
                            contentType = req.headers["content-type"],
                            xmlParser = new xml2js.Parser(
                                {
                                    explicitChildren: true,
                                    preserveChildrenOrder: true
                                }
                            );

                        let structureAsXml;

                        try {
                            let structureFile;

                            if (contentType === "application/zip") {
                                // TODO: unzip the file and check for cmi5.xml
                            }
                            else {
                                structureFile = req.payload.path;
                            }

                            structureAsXml = await readFile(structureFile);
                        }
                        catch (ex) {
                            throw Boom.internal(`Failed to read structure file: ${ex}`);
                        }

                        let structure;

                        try {
                            structure = await xmlParser.parseStringPromise(structureAsXml);
                        }
                        catch (ex) {
                            throw Boom.badRequest(`Failed to parse XML: ${ex}`);
                        }

                        try {
                            structure = validateAndReduceStructure(structure);
                        }
                        catch (ex) {
                            throw Boom.badRequest(`Failed to validate course structure XML: ${ex}`);
                        }

                        let insertResult;

                        try {
                            insertResult = await db.insert(
                                {
                                    tenant_id: 1,
                                    lms_id: lmsId,
                                    metadata: JSON.stringify({
                                        version: 1
                                    }),
                                    structure: JSON.stringify({
                                        version: "1.0.0",
                                        ...structure
                                    })
                                }
                            ).into("courses");
                        }
                        catch (ex) {
                            throw new Error(ex);
                        }

                        return db.first("*").from("courses").where("id", insertResult);
                    }
                },

                {
                    method: "GET",
                    path: "/course/{id}",
                    handler: async (req, h) => {
                        const result = await req.server.app.db.first("*").from("courses").where("id", req.params.id);

                        if (! result) {
                            return Boom.notFound();
                        }

                        return result;
                    }
                },

                {
                    method: "DELETE",
                    path: "/course/{id}",
                    handler: async (req, h) => {
                        const deleteResult = await req.server.app.db("courses").where("id", req.params.id).delete();

                        // TODO: clean up local files

                        return null;
                    }
                }
            ]
        );
    }
};
