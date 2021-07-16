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
import Vue from "vue";
import logs from "./sessions/logs";

const initialState = () => ({
        detailCache: {}
    }),
    wrapItem = (item, {loading = false, loaded = false}) => ({
        item,
        loading,
        loaded,
        error: false,
        errMsg: null
    }),
    populateItem = (item) => {
        item._listen = false;
        item._listener = null;
        item._events = [];

        return item;
    };

export default {
    namespaced: true,
    modules: {
        logs
    },
    state: {
        initialState,
        ...initialState()
    },
    getters: {
        byId: (state) => ({id}) => {
            if (! state.detailCache[id]) {
                Vue.set(
                    state.detailCache,
                    id,
                    wrapItem(
                        populateItem({
                            id
                        }),
                        {
                            loaded: false
                        }
                    )
                );
            }

            return state.detailCache[id];
        }
    },
    actions: {
        alert: ({dispatch}, {content, variant = "danger", kind = "sessionDetail"}) => {
            dispatch(
                "alerts/add",
                {
                    kind,
                    payload: {
                        content,
                        variant
                    }
                },
                {root: true}
            );
        },

        loadById: async ({getters, rootGetters}, {id, force = false}) => {
            const fromCache = getters.byId({id});

            if (fromCache.loaded && ! force) {
                return;
            }

            fromCache.loading = true;

            try {
                const response = await rootGetters["service/makeApiRequest"](`sessions/${id}`);

                if (! response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }

                let body = await response.json();

                body = populateItem(body);

                fromCache.item = body;
                fromCache.loaded = true;
            }
            catch (ex) {
                fromCache.error = true;
                fromCache.errMsg = `Failed to load from id: ${ex}`;
            }
            finally {
                fromCache.loading = false;
            }
        },

        create: async ({dispatch, state, rootGetters}, {testId, auIndex, launchCfg = {}, launchMode, caller = "testDetail"}) => {
            try {
                const response = await rootGetters["service/makeApiRequest"](
                    `sessions`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            testId,
                            auIndex,
                            launchMode,
                            contextTemplateAdditions: launchCfg.contextTemplateAdditions,
                            launchParameters: launchCfg.launchParameters,
                            masteryScore: launchCfg.masteryScore,
                            moveOn: launchCfg.moveOn,
                            alternateEntitlementKey: launchCfg.alternateEntitlementKey
                        })
                    }
                );

                let responseBody = await response.json();

                if (! response.ok) {
                    throw new Error(`Request failed: ${responseBody.message ? responseBody.message : "no message"} (${response.status}${responseBody.srcError ? " - " + responseBody.srcError : ""})`);
                }
                responseBody = populateItem(responseBody);

                if (launchCfg.launchMethod) {
                    responseBody.launchMethod = launchCfg.launchMethod;
                }

                Vue.set(state.detailCache, responseBody.id, wrapItem(responseBody, {loaded: true}));

                return responseBody.id;
            }
            catch (ex) {
                dispatch("alert", {content: `Failed to create session: ${ex}`, kind: caller});
            }

            return null;
        },

        abandon: async ({dispatch, rootGetters}, {id}) => {
            try {
                const response = await rootGetters["service/makeApiRequest"](
                    `sessions/${id}/abandon`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        }
                    }
                );

                if (response.status === 204) {
                    return;
                }

                let responseBody = await response.json();

                if (! response.ok) {
                    throw new Error(`Request failed: ${responseBody.message ? responseBody.message : "no message"} (${response.status}${responseBody.srcError ? " - " + responseBody.srcError : ""})`);
                }
            }
            catch (ex) {
                dispatch("alert", {content: `Failed to abandon session: ${ex}`, kind: "sessionDetail"});
            }
        }
    }
};
