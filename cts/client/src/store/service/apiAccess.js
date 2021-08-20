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
    isBootstrapped: null,
    loading: false,
    error: false,
    errMsg: "",
    access: false,
    item: null,
    username: null,
    password: null,
    expiresAt: null
});

export default {
    namespaced: true,
    state: {
        initialState,
        ...initialState()
    },
    getters: {
        current: (state) => state.item,
        isAdmin: (state) => () => {
            if (state.access && state.item && state.item.roles && state.item.roles.includes("admin")) {
                return true;
            }

            return false;
        }
    },
    mutations: {
        set: (state, {property, value}) => {
            state[property] = value;
        }
    },
    actions: {
        initCredential: async ({commit, rootGetters}) => {
            try {
                const response = await rootGetters["service/makeApiRequest"](
                    "login",
                    {
                        method: "GET"
                    }
                );

                if (! response.ok) {
                    if (response.status === 401) {
                        let body = await response.json();

                        if (typeof body.isBootstrapped !== "undefined") {
                            commit("set", {property: "isBootstrapped", value: body.isBootstrapped});
                        }

                        return;
                    }

                    throw new Error(`Request failed: ${response.status}`);
                }

                let body = await response.json();

                commit("set", {property: "item", value: body.user});
                commit("set", {property: "access", value: true});
                commit("set", {property: "expiresAt", value: body.expiresAt});
                commit("set", {property: "isBootstrapped", value: true});
            }
            catch (ex) {
                console.log(ex);
            }
        },

        storeCredential: async ({commit, rootGetters}, {username, password, storeCookie = false}) => {
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
                        throw "Your username and / or password is incorrect. Please try again.";
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
                commit("set", {property: "expiresAt", value: body.expiresAt});
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
        },

        clearCredentialTimeout: async ({commit, dispatch}) => {
            await dispatch("clearCredential");
            commit("set", {property: "error", value: true});
            commit("set", {property: "errMsg", value: "Your session has timed out, please sign in again."});
        },

        bootstrap: async ({commit, rootGetters}, {username, password}) => {
            commit("set", {property: "error", value: false});
            commit("set", {property: "errMsg", value: ""});
            commit("set", {property: "loading", value: true});

            try {
                const response = await rootGetters["service/makeApiRequest"](
                    "bootstrap",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            firstUser: {
                                username,
                                password
                            }
                        })
                    }
                );

                if (! response.ok) {
                    if (response.status === 409) {
                        throw "Service has already been initialized. Verify potential security issue.";
                    }

                    throw new Error(`Request failed: ${response.status}`);
                }

                //
                // successful response means the service is now setup, mark it
                // as initialized which should then force them to login
                //
                commit("set", {property: "isBootstrapped", value: true});
            }
            catch (ex) {
                commit("set", {property: "error", value: true});
                commit("set", {property: "errMsg", value: ex});
            }
            finally {
                commit("set", {property: "loading", value: false});
            }
        }
    }
};
