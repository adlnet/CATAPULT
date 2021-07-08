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
const Wreck = require("@hapi/wreck"),
    {InvalidPackageError} = require("./errors"),
    _cleanup = {
        courses: []
    };
let playerKey,
    playerSecret,
    playerApi,
    lrsEndpoint,
    lrsKey,
    lrsSecret;

module.exports = {
    init: async () => {
        playerKey = process.env.CATAPULT_PLAYER_KEY;
        playerSecret = process.env.CATAPULT_PLAYER_SECRET;
        playerApi = Wreck.defaults(
            {
                baseUrl: process.env.CATAPULT_PLAYER_API_URL,
                headers: {
                    Authorization: `Basic ${Buffer.from(`${playerKey}:${playerSecret}`).toString("base64")}`
                },
                json: true
            }
        );
        lrsEndpoint = process.env.LRS_ENDPOINT;
        lrsKey = process.env.LRS_KEY;
        lrsSecret = process.env.LRS_SECRET;
    },

    getLrsEndpoint: () => lrsEndpoint,

    getLrsAuthHeader: () => `Basic ${Buffer.from(`${lrsKey}:${lrsSecret}`).toString("base64")}`,

    importCourse: async (stream, contentType, filename) => {
        let importResult;

        try {
            importResult = await playerApi.post(
                "course",
                {
                    headers: {
                        "Content-Type": contentType
                    },
                    payload: stream
                }
            );
        }
        catch (ex) {
            if (ex.isBoom) {
                if (ex.data.payload && ex.data.payload.violatedReqId) {
                    throw new InvalidPackageError(`Invalid package (${ex.data.payload.violatedReqId}): ${ex.data.payload.message})`);
                }

                const err = ex.data.payload ? `${ex.data.payload.message} (${ex.data.payload.srcError}` : ex.data;

                throw new Error(`Failed import request: ${err})`);
            }

            throw new Error(`Failed LMS import of file: ${ex}`);
        }

        _cleanup.courses.push(importResult.payload.id);

        return importResult.payload.id;
    },

    getLaunchUrl: async (courseId, auIndex, actor, {registration, launchMode}) => {
        let getLaunchUrlResult;

        try {
            getLaunchUrlResult = await playerApi.post(
                `course/${courseId}/launch-url/${auIndex}`,
                {
                    payload: {
                        actor,
                        reg: registration,
                        launchMode,
                        contextTemplateAdditions: ""
                    }
                }
            );
        }
        catch (ex) {
            if (ex.isBoom) {
                const err = ex.data.payload ? `${ex.data.payload.message} (${ex.data.payload.srcError}` : ex.data;

                throw new Error(`Failed get launch URL request: ${err}`);
            }

            throw new Error(`Failed to get launch URL from LMS: ${ex}`);
        }

        return getLaunchUrlResult.payload.url;
    },

    cleanup: async () => {
        try {
            for (const courseId of _cleanup.courses) {
                await playerApi.delete(`course/${courseId}`);
            }
        }
        catch (ex) {
            console.log(`Failed LMS delete of course(s): ${ex}`);
        }
    },

    hasWaive: () => true,
    waiveAU: async (registration, auIndex, reason) => {
        let waiveResult;

        try {
            waiveResult = await playerApi.post(
                `registration/${registration}/waive-au/${auIndex}`,
                {
                    payload: {
                        reason
                    }
                }
            );
        }
        catch (ex) {
            if (ex.isBoom) {
                const err = ex.data.payload ? `${ex.data.payload.message} (${ex.data.payload.srcError})` : ex.data;

                throw new Error(`Failed waive AU request: ${err}`);
            }

            throw new Error(`Failed to waive AU from LMS: ${ex}`);
        }
    },

    hasAbandon: () => true,
    abandonSession: async (sessionId) => {
        let abandonResult;

        try {
            abandonResult = await playerApi.post(
                `session/${sessionId}/abandon`,
                {
                    payload: {}
                }
            );
        }
        catch (ex) {
            if (ex.isBoom) {
                const err = ex.data.payload ? `${ex.data.payload.message} (${ex.data.payload.srcError})` : ex.data;

                throw new Error(`Failed abandon request: ${err}`);
            }

            throw new Error(`Failed to abandon from LMS: ${ex}`);
        }
    }
};
