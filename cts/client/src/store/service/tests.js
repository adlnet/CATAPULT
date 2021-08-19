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
import logs from "./tests/logs";

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
        item.learnerPrefs = {
            _etag: null,
            languagePreference: "",
            audioPreference: null
        };

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

                let body = await response.json();

                if (! response.ok) {
                    throw new Error(`Request failed: ${body.message} (${response.status})${body.srcError ? " (" + body.srcError + ")" : ""}`);
                }

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
                const response = await rootGetters["service/makeApiRequest"](`courses/${courseId}/tests`);

                if (! response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }

                const body = await response.json(),
                    duplicateCheck = cache.items.map((i) => i.id);

                for (const i of body.items) {
                    if (duplicateCheck.includes(i.id)) {
                        continue;
                    }

                    i.pending = null;

                    cache.items.push(i);
                }

                cache.loaded = true;

                for (const i of body.items) {
                    if (! state.detailCache[i.id]) {
                        Vue.set(
                            state.detailCache,
                            i.id,
                            wrapItem(populateItem(i), {loaded: true})
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

        create: async ({dispatch, state, getters, rootGetters}, {courseId, actor}) => {
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

                Vue.set(state.detailCache, responseBody.id, wrapItem(responseBody, {loaded: true}));

                const courseCache = getters.cache({cacheKey: getters.cacheKey({courseId})});

                courseCache.items.unshift(responseBody);

                return responseBody.id;
            }
            catch (ex) {
                dispatch("alert", {content: `Failed to create test: ${ex}`, kind});
            }

            return null;
        },

        waiveAU: async ({dispatch, rootGetters}, {id, auIndex, reason}) => {
            try {
                const response = await rootGetters["service/makeApiRequest"](
                    `tests/${id}/waive-au/${auIndex}`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            reason
                        })
                    }
                );

                if (response.status === 204) {
                    dispatch("logs/load", {props: {id}, force: true});
                    return;
                }

                let responseBody = await response.json();

                if (! response.ok) {
                    throw new Error(`Request failed: ${responseBody.message ? responseBody.message : "no message"} (${response.status}${responseBody.srcError ? " - " + responseBody.srcError : ""})`);
                }
            }
            catch (ex) {
                dispatch("alert", {content: `Failed to waive AU: ${ex}`, kind: "testDetail"});
            }
        },

        loadLearnerPrefs: async ({getters, dispatch, rootGetters}, {id}) => {
            try {
                const test = getters.byId({id}),
                    response = await rootGetters["service/makeApiRequest"](
                        `tests/${id}/learner-prefs`,
                        {
                            method: "GET"
                        }
                    );

                if (response.status === 404) {
                    test.item.learnerPrefs._etag = null;
                    test.item.learnerPrefs.languagePreference = "";
                    test.item.learnerPrefs.audioPreference = null;

                    return;
                }

                let responseBody = await response.json();

                if (! response.ok) {
                    throw new Error(`Request failed: ${responseBody.message ? responseBody.message : "no message"} (${response.status}${responseBody.srcError ? " - " + responseBody.srcError : ""})`);
                }

                test.item.learnerPrefs._etag = response.headers.get("etag") || null;
                test.item.learnerPrefs.languagePreference = responseBody.languagePreference;
                test.item.learnerPrefs.audioPreference = responseBody.audioPreference;
            }
            catch (ex) {
                dispatch("alert", {content: `Failed to load learner preferences: ${ex}`, kind: "testDetail"});
            }
        },

        saveLearnerPrefs: async ({getters, dispatch, rootGetters}, {id}) => {
            const test = getters.byId({id});

            try {
                const response = await rootGetters["service/makeApiRequest"](
                    `tests/${id}/learner-prefs`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...(test.item.learnerPrefs._etag === null ? {"If-None-Match": "*"} : {"If-Match": test.item.learnerPrefs._etag})
                        },
                        body: JSON.stringify({
                            languagePreference: test.item.learnerPrefs.languagePreference,
                            audioPreference: test.item.learnerPrefs.audioPreference
                        })
                    }
                );

                if (response.status === 204) {
                    //
                    // after successfully saving the preferences the Etag is out of date, and rather than
                    // trying to calculate it client side for the new value, just fetch the preferences
                    // again to get the new Etag
                    //
                    dispatch("loadLearnerPrefs", {id});

                    dispatch("alert", {content: `Agent preferences saved`, kind: "testDetail", variant: "success"});

                    return;
                }

                let responseBody = await response.json();

                if (! response.ok) {
                    throw new Error(`Request failed: ${responseBody.message ? responseBody.message : "no message"} (${response.status}${responseBody.srcError ? " - " + responseBody.srcError : ""})`);
                }
            }
            catch (ex) {
                dispatch("alert", {content: `Failed to save learner preferences: ${ex}`, kind: "testDetail"});
            }
        },

        clearLearnerPrefs: async ({getters, dispatch, rootGetters}, {id}) => {
            const test = getters.byId({id});

            try {
                const response = await rootGetters["service/makeApiRequest"](
                    `tests/${id}/learner-prefs`,
                    {
                        method: "DELETE",
                        headers: {
                            "Content-Type": "application/json",
                            "If-Match": test.item.learnerPrefs._etag
                        }
                    }
                );

                if (response.status === 204) {
                    test.item.learnerPrefs.languagePreference = "";
                    test.item.learnerPrefs.audioPreference = null;
                    test.item.learnerPrefs._etag = null;

                    dispatch("alert", {content: `Agent preferences cleared`, kind: "testDetail", variant: "success"});

                    return;
                }

                let responseBody = await response.json();

                if (! response.ok) {
                    throw new Error(`Request failed: ${responseBody.message ? responseBody.message : "no message"} (${response.status}${responseBody.srcError ? " - " + responseBody.srcError : ""})`);
                }
            }
            catch (ex) {
                dispatch("alert", {content: `Failed to clear learner preferences: ${ex}`, kind: "testDetail"});
            }
        },

        triggerDownload: async ({getters, dispatch, rootGetters}, {id}) => {
            await dispatch("loadById", {id, force: true});
            await dispatch("logs/load", {props: {id}, force: true});

            const test = getters.byId({id}).item,
                logs = getters["logs/cache"]({cacheKey: getters["logs/cacheKey"]({id})}),
                code = test.code,
                sessionCreationItems = logs.items.filter((item) => (item.metadata && item.metadata.resource === "sessions:create")),
                sessionLoadPromises = [];

            for (const item of sessionCreationItems) {
                sessionLoadPromises.push(dispatch("service/sessions/loadById", {id: item.metadata.sessionId, force: true}, {root: true}));
                sessionLoadPromises.push(dispatch("service/sessions/logs/load", {props: {id: item.metadata.sessionId}, force: true}, {root: true}));
            }

            await Promise.all(sessionLoadPromises);

            const fileContents = {
                    id,
                    code,
                    dateCreated: new Date().toJSON(),
                    metadata: test.metadata
                },

                //
                // this is a little unorthodox/odd for a service to be performing but it
                // makes some sort of sense because this service action can be dispatched
                // by multiple components, and since the element handling is really outside
                // of the scope of what Vue should be expected to provide it mostly doesn't
                // matter where we put it, it'll be odd anywhere else too
                //
                element = document.createElement("a");

            fileContents.logs = logs.items.map(
                (logItem) => {
                    const result = {
                        ...logItem
                    };

                    if (logItem.metadata && logItem.metadata.resource === "sessions:create") {
                        result.session = {
                            metadata: rootGetters["service/sessions/byId"]({id: logItem.metadata.sessionId}).item.metadata,
                            // create a new array so that it can be inplace sorted
                            logs: [
                                ...rootGetters["service/sessions/logs/cache"](
                                    {
                                        cacheKey: rootGetters["service/sessions/logs/cacheKey"]({id: logItem.metadata.sessionId})
                                    }
                                ).items
                            ]
                        };

                        result.session.logs.sort((a, b) => a.id - b.id);
                    }

                    return result;
                }
            );

            fileContents.logs.sort((a, b) => a.id - b.id);

            element.setAttribute("href", "data:text/plain;charset=utf-8," + JSON.stringify(fileContents, null, 2)); // eslint-disable-line no-magic-numbers
            element.setAttribute("download", `catapult-cts-${code}.json`);

            element.style.display = "none";
            document.body.appendChild(element);

            element.click();
            document.body.removeChild(element);
        }
    }
};
