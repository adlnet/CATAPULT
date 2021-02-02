<template>
    <b-row>
        <b-col>
            <template v-if="model">
                <h2 class="mb-3">{{ model.title }}</h2>
            </template>
            <template v-else>
                Load model?
            </template>
        </b-col>
    </b-row>
</template>

<script>
    export default {
        name: "CourseDetail",
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
        }
    };
</script>

<style lang="scss" scoped>
</style>

