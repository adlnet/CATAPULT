import Vue from "vue";
import Vuex from "vuex";
import service from "./service";

Vue.use(Vuex);

export default new Vuex.Store(
    {
        namespaced: true,
        modules: {
            service
        }
    }
);
