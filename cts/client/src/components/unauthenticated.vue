<template>
    <b-col>
        catapult
        <br>
        cmi5 conformance test suite
        <br>
        <!-- TODO: should this have a separate router view? -->
        <sign-in />
    </b-col>
</template>

<script>
    import signIn from "@/components/unauthenticated/signIn";

    export default {
        name: "unauthenticated",
        components: {
            signIn
        }
    };
</script>

<style lang="scss">
</style>
