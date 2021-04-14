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
const initialState = () => ({
    loading: false,
    error: false,
    errMsg: "",
    access: false,
    item: null,
    username: null,
    password: null
});

export default {
    namespaced: true,
    state: {
        initialState,
        ...initialState()
    },
    mutations: {
        set: (state, {property, value}) => {
            state[property] = value;
        }
    },
    actions: {
        initCredential: async ({commit, rootGetters}) => {
            console.log("service:apiAccess:initCredential");

            try {
                const response = await rootGetters["service/makeApiRequest"](
                    "login",
                    {
                        method: "GET"
                    }
                );

                if (! response.ok) {
                    if (response.status === 401) {
                        return;
                    }

                    throw new Error(`Request failed: ${response.status}`);
                }

                let body = await response.json();

                commit("set", {property: "item", value: body});
                commit("set", {property: "access", value: true});
            }
            catch (ex) {
                console.log(ex);
            }
        },

        storeCredential: async ({commit, rootGetters}, {username, password, storeCookie = false}) => {
            console.log("service:apiAccess:initCredential");

            commit("set", {property: "error", value: false});
            commit("set", {property: "errMsg", value: ""});
            commit("set", {property: "loading", value: true});

            try {
                const response = await rootGetters["service/makeApiRequest"](
                    "login",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            username,
                            password,
                            storeCookie
                        })
                    }
                );

                if (! response.ok) {
                    if (response.status === 401) {
                        throw "Your email address and / or password is incorrect. Please try again.";
                    }

                    throw new Error(`Request failed: ${response.status}`);
                }

                let body = await response.json();

                //
                // if they didn't want to be remembered then we don't get a cookie
                // in which case we just need to store the username/password and then
                // make the requests set the basic auth
                //
                if (! storeCookie) {
                    commit("set", {property: "username", value: username});
                    commit("set", {property: "password", value: password});
                }

                commit("set", {property: "item", value: body});
                commit("set", {property: "access", value: true});
            }
            catch (ex) {
                commit("set", {property: "error", value: true});
                commit("set", {property: "errMsg", value: ex});
            }
            finally {
                commit("set", {property: "loading", value: false});
            }
        },

        clearCredential: async ({commit, rootGetters}) => {
            try {
                const response = await rootGetters["service/makeApiRequest"](
                    "logout",
                    {
                        method: "GET"
                    }
                );

                if (! response.ok) {
                    if (response.status === 401) {
                        return;
                    }

                    throw new Error(`Request failed: ${response.status}`);
                }
            }
            catch (ex) {
                console.log(ex);
            }

            commit("resetState", null, {root: true});
        }
    }
};
