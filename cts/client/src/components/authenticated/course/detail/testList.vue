<template>
    <b-row>
        <b-col>
            Test List tab
        </b-col>
    </b-row>
</template>

<script>
    // import Vuex from "vuex";

    export default {
        name: "CourseDetailTestList",
        props: {
            id: {
                type: String,
                required: true
            }
        },
        data: () => ({
        }),
        computed: {
            model () {
                return this.$store.getters["service/courses/byId"]({id: this.id});
            }
        },
        methods: {
        }
    };
</script>

<style lang="scss" scoped>
</style>
