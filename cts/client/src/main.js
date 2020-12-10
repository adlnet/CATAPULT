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

const provision = () => {
    new Vue(
        {
            router,
            store,
            render: (h) => h(app)
        }
    ).$mount("#app");
};

provision();
