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
    cacheContainer: {},
});

export default {
    namespaced: true,
    state: {
        initialState,
        ...initialState()
    },
    getters: {
        list: (state) => (kind) => {
            if (! state.cacheContainer[kind]) {
                return;
            }

            return state.cacheContainer[kind];
        }
    },
    mutations: {
        add (state, {kind, payload}) {
            if (! state.cacheContainer[kind]) {
                Vue.set(
                    state.cacheContainer,
                    kind,
                    []
                );
            }

            state.cacheContainer[kind].push(
                {
                    id: Date.now(),
                    variant: "danger",
                    ...payload
                }
            );
        },
        remove (state, {kind, id}) {
            const alerts = state.cacheContainer[kind],
                alertIndex = alerts.findIndex((i) => i.id === id);

            if (alertIndex !== -1) {
                alerts.splice(alertIndex, 1);
            }
        }
    },
    actions: {
        add: ({commit}, {kind, payload}) => {
            commit("add", {kind, payload});
        },
        remove: ({commit}, {kind, id}) => {
            commit("remove", {kind, id});
        }
    }
};
