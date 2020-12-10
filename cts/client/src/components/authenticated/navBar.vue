<template>
    <b-navbar fixed sticky>
        <b-row class="flex-fill">
            <b-col class="col-auto">
                <h1 class="title">
                    catapult
                </h1>
            </b-col>
            <b-col>
                <b-breadcrumb>
                    <b-breadcrumb-item href="#">
                        Home
                    </b-breadcrumb-item>
                </b-breadcrumb>
            </b-col>
            <b-col class="col-auto text-right">
                <b-button variant="primary" size="sm" class="mr-2">New Course</b-button>
                <b-button variant="primary" size="sm">New Test</b-button>
            </b-col>
        </b-row>
    </b-navbar>
</template>

<script>
    export default {
        name: "nav-bar",
        data: () => ({
        })
    };
</script>

<style lang="scss">
    .title {
        color: $gray-500;

        &::first-letter {
            color: $primary;
        }
    }

    ol.breadcrumb {
        background-color: inherit;
    }
</style>
