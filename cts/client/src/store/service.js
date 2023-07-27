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
import apiAccess from "./service/apiAccess";
import courses from "./service/courses";
import tests from "./service/tests";
import sessions from "./service/sessions";
import users from "./service/users";

export default {
    namespaced: true,
    getters: {
        baseApiUrl: () => process.env.VUE_APP_API_URL ? process.env.VUE_APP_API_URL : "",
        makeApiRequest: (state, getters) => (resource, cfg = {}) => {
            const fetchCfg = {
                ...cfg
            };

            if (state.apiAccess.username) {
                fetchCfg.headers = fetchCfg.headers || {};
                fetchCfg.headers.Authorization = `Basic ${Buffer.from(`${state.apiAccess.username}:${state.apiAccess.password}`).toString("base64")}`;
            }
            else {
                fetchCfg.credentials = "include";
            }

            return fetch(`${getters.baseApiUrl}/api/v1/${resource}`, fetchCfg);
        }
    },
    modules: {
        apiAccess,
        courses,
        tests,
        sessions,
        users
    }
};
