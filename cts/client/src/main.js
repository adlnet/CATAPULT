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
import BootstrapVue from "bootstrap-vue";
import Moment from "vue-moment";
import faker from "faker/locale/en";
import router from "./router";
import store from "./store";
import app from "./components/app.vue";

import "./main.scss";

Vue.use(Moment);
Vue.use(BootstrapVue);

Vue.config.productionTip = false;

Object.defineProperty(
    Vue.prototype,
    "$faker",
    {
        get () {
            return faker;
        }
    }
);

const provision = async () => {
    //
    // Try to init the credential to see if there is a cookie already
    // available, if so, the login screen won't be presented, otherwise
    // they need to enter their username and password and optionally get
    // a cookie set, if they don't request a cookie then a refresh of the
    // page will re-present the login form
    //
    await store.dispatch("service/apiAccess/initCredential");

    new Vue(
        {
            router,
            store,
            render: (h) => h(app)
        }
    ).$mount("#app");
};

provision();
