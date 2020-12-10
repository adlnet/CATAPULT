<template>
    <b-col class="d-flex flex-column">
        <nav-bar />
        <b-row class="flex-fill">
            <b-col style="padding: 1em 30px 0px 30px;">
                Signed in view
                <!--router-view/-->
            </b-col>
        </b-row>
    </b-col>
</template>

<script>
    import navBar from "@/components/authenticated/navBar";

    export default {
        name: "authenticated",
        components: {
            navBar
        },
        data: () => ({
        })
    };
</script>

<style lang="scss">
</style>
