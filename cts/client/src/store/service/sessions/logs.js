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
/* globals TextDecoderStream, TransformStream */
import Vue from "vue";
import "@stardazed/streams-polyfill";

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
                        errMsg: "",
                        listener: null,
                        listen: false
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
                const response = await rootGetters["service/makeApiRequest"](`sessions/${props.id}/logs`);

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
        },

        startListener: async ({getters, rootGetters}, props) => {
            const cacheEntry = getters.cache({cacheKey: getters.cacheKey(props)}),
                response = await rootGetters["service/makeApiRequest"](`sessions/${props.id}/logs?listen=true`),
                stream = response.body.pipeThrough(new TextDecoderStream()).pipeThrough(
                    //
                    // this stream takes the text stream as input, splits the text on \n
                    // and then JSON parses the lines, providing each chunk of JSON to
                    // the next handler in the chain
                    //
                    new TransformStream(
                        {
                            start (controller) {
                                controller.buf = "";
                                controller.pos = 0;
                            },
                            transform (chunk, controller) {
                                controller.buf += chunk;

                                while (controller.pos < controller.buf.length) {
                                    if (controller.buf[controller.pos] === "\n") {
                                        const line = controller.buf.substring(0, controller.pos);

                                        controller.enqueue(JSON.parse(line));

                                        controller.buf = controller.buf.substring(controller.pos + 1);
                                        controller.pos = 0;
                                    }
                                    else {
                                        ++controller.pos;
                                    }
                                }
                            }
                        }
                    )
                ),
                reader = cacheEntry.listener = stream.getReader();

            cacheEntry.listen = true;

            while (cacheEntry.listen) { // eslint-disable-line no-constant-condition
                try {
                    const {done, value} = await reader.read();

                    cacheEntry.items.unshift(value);

                    if (done) {
                        break;
                    }
                }
                catch (ex) {
                    break;
                }
            }
        },

        stopListener: async ({getters}, props) => {
            const cacheEntry = getters.cache({cacheKey: getters.cacheKey(props)});

            if (cacheEntry.listener) {
                cacheEntry.listen = false;

                await cacheEntry.listener.closed;
                cacheEntry.listener.releaseLock();

                cacheEntry.listener = null;
            }
        }
    }
};
