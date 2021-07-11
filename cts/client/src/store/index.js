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
import Vuex from "vuex";
import alerts from "./alerts";
import service from "./service";

Vue.use(Vuex);

export default new Vuex.Store(
    {
        namespaced: true,
        modules: {
            alerts,
            service
        },
        mutations: {
            resetState (state) {
                Object.assign(state.alerts, state.alerts.initialState());

                Object.assign(state.service.sessions, state.service.sessions.initialState());
                Object.assign(state.service.tests, state.service.tests.initialState());
                Object.assign(state.service.courses, state.service.courses.initialState());

                // logout shouldn't clear isBootstrapped
                const apiAccess = state.service.apiAccess.initialState();

                apiAccess.isBootstrapped = state.service.apiAccess.isBootstrapped;

                Object.assign(state.service.apiAccess, apiAccess);
            }
        }
    }
);
