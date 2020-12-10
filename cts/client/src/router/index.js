import Vue from "vue";
import VueRouter from "vue-router";

Vue.use(VueRouter);

// TODO: do we need two routers, one for authenticated one for not? Is there a way to do two routers?

const router = new VueRouter(
    {
        routes: []
    }
);

export default router;
