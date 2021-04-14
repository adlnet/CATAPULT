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

const initialState = () => ({
        detailCache: {},
        cacheContainer: {},
        defaultKeyProperties: {}
    }),
    wrapItem = (item, {loading = false, loaded = false}) => ({
        item,
        loading,
        loaded,
        error: false,
        errMsg: null
    }),
    populateItem = (item) => {
        return item;
    };

export default {
    namespaced: true,
    state: {
        initialState,
        ...initialState()
    },
    getters: {
        cacheKey: (state) => ({courseId}) => {
            //
            // there isn't really a technical reason why we should only be able to pull the list
            // of tests based on a course id, but when written the UI only provided for listing
            // tests at the course level so this was arbitrarily restricted based on that and the
            // service back end only has a route for getting tests under the /courses resource
            //
            if (typeof courseId === "undefined") {
                throw new Error("courseId is a required cache key component");
            }

            const cacheKey = `key-${courseId}`;

            if (! state.cacheContainer[cacheKey]) {
                Vue.set(
                    state.cacheContainer,
                    cacheKey,
                    {
                        loaded: false,
                        loading: false,
                        items: [],
                        currentIndex: null
                    }
                );
            }

            return cacheKey;
        },

        cache: (state) => ({cacheKey}) => state.cacheContainer[cacheKey],

        byId: (state) => ({id}) => {
            if (! state.detailCache[id]) {
                Vue.set(
                    state.detailCache,
                    id,
                    wrapItem(
                        {
                            id
                        },
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
        alert: ({dispatch}, {content, variant = "danger", kind = "testList"}) => {
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
                const response = await rootGetters["service/makeApiRequest"](`tests/${id}`);

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

        load: async ({dispatch, state, getters, rootGetters}, {courseId, props = state.defaultKeyProperties, force = false} = {}) => {
            const cache = getters.cache({cacheKey: getters.cacheKey({courseId, ...props})}),
                busyKey = "loading";

            if (cache.loaded || cache.loading) {
                if (! force) {
                    return;
                }

                cache.items = cache.items.filter((i) => i.id === null);
            }

            cache[busyKey] = true;

            try {
                const response = await rootGetters["service/makeApiRequest"](`courses/${courseId}/tests`),
                    lastNewItemIndex = cache.items.findIndex((i) => i.id !== null);

                if (! response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }

                const body = await response.json();

                cache.items.splice(
                    lastNewItemIndex === -1 ? cache.items.length : lastNewItemIndex + 1,
                    0,
                    ...body.items.map(
                        (i) => {
                            i.pending = null;

                            return i;
                        }
                    )
                );
                cache.loaded = true;

                for (const i of body.items) {
                    if (! state.detailCache[i.id]) {
                        Vue.set(
                            state.detailCache,
                            i.id,
                            wrapItem(i, {loaded: true})
                        );
                    }
                }
            }
            catch (ex) {
                const content = `Failed to load tests: ${ex}`

                cache.err = true;
                cache.errMsg = content;

                dispatch("alert", {content});
            }

            // eslint-disable-next-line require-atomic-updates
            cache[busyKey] = false;
        },

        create: async ({dispatch, state, rootGetters}, {courseId, actor}) => {
            const kind = "testNew";

            try {
                const response = await rootGetters["service/makeApiRequest"](
                    "tests",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            courseId,
                            actor
                        })
                    }
                );

                let responseBody = await response.json();

                if (! response.ok) {
                    throw new Error(`Request failed: ${responseBody.message ? responseBody.message : "no message"} (${response.status}${responseBody.srcError ? " - " + responseBody.srcError : ""})`);
                }
                responseBody = populateItem(responseBody);

                state.detailCache[responseBody.id] = wrapItem(responseBody, {loaded: true});

                return responseBody.id;
            }
            catch (ex) {
                dispatch("alert", {content: `Failed to create test: ${ex}`, kind});
            }

            return null;
        }
    }
};
