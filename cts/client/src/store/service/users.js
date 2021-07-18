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
        alert: ({dispatch}, {content, variant = "danger", kind = "adminUserList"}) => {
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
                const response = await rootGetters["service/makeApiRequest"](`users/${id}`);

                if (! response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }

                const body = await response.json();

                fromCache.item = populateItem(body);
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
                const response = await rootGetters["service/makeApiRequest"]("users"),
                    lastNewItemIndex = cache.items.findIndex((i) => i.id !== null);

                if (! response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }

                const body = await response.json();

                cache.items.splice(
                    lastNewItemIndex === -1 ? cache.items.length : lastNewItemIndex + 1,
                    0,
                    ...body.items
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
                const content = `Failed to load users: ${ex}`

                cache.err = true;
                cache.errMsg = content;

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
                    `users/${item.id}`,
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
                    const body = await response.json();

                    throw new Error(`${response.status} - ${body.message}`);
                }
            }
            catch (ex) {
                dispatch("alert", {content: `Failed to delete user (id: ${item.id}): ${ex}`});

                return false;
            }

            return true;
        },

        create: async ({dispatch, state, getters, rootGetters}, {username, password, roles = []}) => {
            try {
                const response = await rootGetters["service/makeApiRequest"](
                    "users",
                    {
                        method: "POST",
                        mode: "cors",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            username,
                            password,
                            roles
                        })
                    }
                );

                let responseBody = await response.json();

                if (! response.ok) {
                    throw new Error(`Request failed: ${responseBody.message ? responseBody.message : "no message"} (${response.status})`);
                }

                responseBody = populateItem(responseBody);

                Vue.set(state.detailCache, responseBody.id, wrapItem(responseBody, {loaded: true}));
                getters.cache({cacheKey: getters.cacheKey()}).items.unshift(responseBody);

                dispatch("alert", {content: `User created: ${responseBody.id}`, kind: "success"});

                return responseBody.id;
            }
            catch (ex) {
                dispatch("alert", {content: `Failed to create user: ${ex}`});
            }

            return null;
        }
    }
};
