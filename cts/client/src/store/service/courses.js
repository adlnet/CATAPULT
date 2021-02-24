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
import Vue from "vue";

const populateItem = (item, {loading = false, loaded = false}) => ({
    loading,
    loaded,
    item,
    error: false,
    errMsg: null
});

export default {
    namespaced: true,
    state: {
        detailCache: {},
        cacheContainer: {},
        defaultKeyProperties: {}
    },
    getters: {
        cacheKey: (state) => () => {
            const cacheKey = "key";

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
        defaultCacheKey: (state, getters) => getters.cacheKey({props: state.defaultKeyProperties}),

        cache: (state) => ({cacheKey}) => state.cacheContainer[cacheKey],
        defaultCache: (state, getters) => getters.cache({cacheKey: getters.defaultCacheKey}),

        byId: (state) => ({id}) => {
            if (! state.detailCache[id]) {
                Vue.set(
                    state.detailCache,
                    id,
                    populateItem(
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
        alert: ({dispatch}, {content, variant, kind = "courseList"}) => {
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
                const response = await rootGetters["service/makeApiRequest"](`courses/${id}`);

                if (! response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }

                const body = await response.json();
                body.metadata = JSON.parse(body.metadata);

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

        load: async ({dispatch, state, getters, rootGetters}, {props = state.defaultKeyProperties, force = false} = {}) => {
            const cache = getters.cache({cacheKey: getters.cacheKey({props})}),
                busyKey = "loading";

            if (cache.loaded || cache.loading) {
                if (! force) {
                    return;
                }

                cache.items = cache.items.filter((i) => i.id === null);
            }

            cache[busyKey] = true;

            try {
                const response = await rootGetters["service/makeApiRequest"]("courses"),
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
                            populateItem(i, {loaded: true})
                        );
                    }
                }
            }
            catch (ex) {
                dispatch("alert", {content: `Failed to load courses: ${ex}`});
            }

            // eslint-disable-next-line require-atomic-updates
            cache[busyKey] = false;
        },

        delete: async ({dispatch, getters, rootGetters}, {item}) => {
            const cache = getters.defaultCache,
                itemIndex = cache.items.findIndex((i) => i === item);

            try {
                const response = await rootGetters["service/makeApiRequest"](
                    `courses/${item.id}`,
                    {
                        method: "DELETE",
                        mode: "cors"
                    }
                );

                if (response.ok) {
                    if (itemIndex !== -1) {
                        cache.items.splice(itemIndex, 1);

                        if (cache.currentIndex === itemIndex) {
                            cache.currentIndex = null;
                        }
                    }
                }
                else {
                    throw new Error(response.status);
                }
            }
            catch (ex) {
                dispatch("alert", {content: `Failed to delete course (id: ${item.id}): ${ex}`});
            }
        },

        import: async ({dispatch, state, rootGetters}, {body, contentType}) => {
            const kind = "courseNew";

            try {
                const response = await rootGetters["service/makeApiRequest"](
                    "courses",
                    {
                        method: "POST",
                        mode: "cors",
                        headers: {
                            "Content-Type": contentType
                        },
                        body
                    }
                );

                const responseBody = await response.json();

                if (! response.ok) {
                    throw new Error(`Request failed: ${responseBody.message ? responseBody.message : "no message"} (${response.status}${responseBody.srcError ? " - " + responseBody.srcError : ""})`);
                }

                responseBody.metadata = JSON.parse(responseBody.metadata);

                state.detailCache[responseBody.id] = populateItem(responseBody, {loaded: true});

                dispatch(
                    "alert",
                    {
                        variant: "success",
                        content: `Imported course. (${responseBody.id})`,
                        kind
                    }
                );

                return responseBody.id;
            }
            catch (ex) {
                dispatch("alert", {content: `Failed to import course: ${ex}`, kind});
            }

            return null;
        }
    }
};
