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
    cacheContainer: {}
});

export default {
    namespaced: true,
    state: {
        initialState,
        ...initialState()
    },
    getters: {
        cacheKey: (state) => ({id}) => {
            const cacheKey = `key-${id}`;

            if (! state.cacheContainer[cacheKey]) {
                Vue.set(
                    state.cacheContainer,
                    cacheKey,
                    {
                        loaded: false,
                        loading: false,
                        items: [],
                        err: false,
                        errMsg: ""
                    }
                );
            }

            return cacheKey;
        },

        cache: (state) => ({cacheKey}) => state.cacheContainer[cacheKey]
    },
    actions: {
        load: async ({getters, rootGetters}, {props, force = false} = {}) => {
            const cache = getters.cache({cacheKey: getters.cacheKey(props)}),
                busyKey = "loading";

            if (cache.loaded || cache.loading) {
                if (! force) {
                    return;
                }
            }

            cache[busyKey] = true;

            try {
                const response = await rootGetters["service/makeApiRequest"](`tests/${props.id}/logs`);

                if (! response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }

                const body = await response.json();

                cache.items = body;
                cache.loaded = true;
            }
            catch (ex) {
                const content = `Failed to load session logs (${props.id}): ${ex}`

                cache.err = true;
                cache.errMsg = content;
            }

            // eslint-disable-next-line require-atomic-updates
            cache[busyKey] = false;
        }
    }
};
