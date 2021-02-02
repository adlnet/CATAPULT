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

export default {
    namespaced: true,
    state: {
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

        byId: (state, getters) => ({id}) => {
            const cache = state.cacheContainer[getters.defaultCacheKey];

            console.log(cache.items);

            return cache.items.find((element) => element.id === id);
        }
    },
    actions: {
        alert: ({dispatch}, {content, kind = "courseList"}) => {
            dispatch(
                "alerts/add",
                {
                    kind,
                    payload: {
                        content
                    }
                },
                {root: true}
            );
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
            }
            catch (ex) {
                let content = "Failed to load courses: ";

                if (ex.error) {
                    content += ex.error.message;

                    if (ex.error.srcError) {
                        content += ` (${ex.error.srcError.message ? ex.error.srcError.message : ex.error.srcError})`;
                    }
                }
                else {
                    content += ex;
                }

                dispatch("alert", {content});
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
                let content = `Failed to delete course (id: ${item.id}): `;

                if (ex.error) {
                    content += ex.error.message;

                    if (ex.error.srcError) {
                        content += ` (${ex.error.srcError.message ? ex.error.srcError.message : ex.error.srcError})`;
                    }
                }
                else {
                    content += ex;
                }

                dispatch("alert", {content});
            }
        },

        upload: async ({dispatch, rootGetters}, {file}) => {
            const kind = "courseNew";

            try {
                const response = await rootGetters["service/makeApiRequest"](
                    "courses",
                    {
                        method: "POST",
                        mode: "cors",
                        body: file
                    }
                );

                if (! response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }

                const body = await response.json();

                dispatch(
                    "alert",
                    {
                        variant: "success",
                        kind,
                        content: `Imported course. (${body.id})`
                    }
                );

                return body.id;
            }
            catch (ex) {
                let content = "Failed to upload course: ";

                if (ex.error) {
                    content += ex.error.message;

                    if (ex.error.srcError) {
                        content += ` (${ex.error.srcError.message ? ex.error.srcError.message : ex.error.srcError})`;
                    }
                }
                else {
                    content += ex;
                }

                dispatch("alert", {content, kind});
            }

            return null;
        }
    }
};
