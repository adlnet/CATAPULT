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
import signIn from "./service/signIn";
import courses from "./service/courses";

export default {
    namespaced: true,
    getters: {
        makeApiRequest: (state) => (resource, cfg = {}) => {
            if (state.signIn.access) {
                // TODO: need to handle authentication, adding base URL, etc.
                return fetch(
                    `http://Rustici-BJM.local:3399/api/v1/${resource}`,
                    cfg
                );
            }

            throw new Error("Unauthenticated");
        }
    },
    modules: {
        signIn,
        courses
    }
};
