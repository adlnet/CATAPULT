import signIn from "./service/signIn";

export default {
    namespaced: true,
    computed: {
        request: (state) => {
            if (state.service.signIn) {
                return {};
            }

            return null;
        }
    },
    modules: {
        signIn
    }
};
