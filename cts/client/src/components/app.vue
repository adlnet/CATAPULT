<template>
    <b-container fluid class="d-flex flex-column" style="min-height: 100vh; padding: 0px;">
        <b-row v-if="isSignedIn" class="flex-fill">
            <authenticated />
        </b-row>
        <b-row v-else>
            <unauthenticated />
        </b-row>
    </b-container>
</template>

<script>
    import Vuex from "vuex";
    import authenticated from "@/components/authenticated";
    import unauthenticated from "@/components/unauthenticated";

    export default {
        name: "app",
        components: {
            authenticated,
            unauthenticated
        },
        computed: {
            ...Vuex.mapState(
                "service/signIn",
                {
                    isSignedIn: (state) => state.access !== null
                }
            )
        }
    };
</script>

<style lang="scss">
</style>
