<template>
    <b-row>
        <b-col>
            <template v-if="model.loading">
                Loading...
            </template>
            <template v-else-if="model.error">
                Course load error: {{ model.errMsg }}
            </template>
            <template v-else>
                <b-row>
                    <b-col>
                        <h3 class="mb-3">{{ model.item.metadata.structure.course.title[0].text }}</h3>
                    </b-col>
                    <b-col cols="auto">
                        <b-button variant="primary" class="mr-2" :to="`/test-new/${id}`">Test</b-button>
                        <b-button variant="outline-danger">Delete</b-button>
                    </b-col>
                </b-row>
                <b-row>
                    <b-col>
                        Course ID: {{ model.item.metadata.structure.course.id }}
                        <br>
                        Imported: {{ model.item.createdAt | moment("from", "now") }}
                        <br>
                        <b-nav tabs class="my-3">
                            <b-nav-item :to="`/courses/${id}`" exact active-class="active">
                                Conformance Tests
                            </b-nav-item>
                            <b-nav-item :to="`/courses/${id}/structure`" active-class="active">
                                Course Structure
                            </b-nav-item>
                        </b-nav>
                        <keep-alive>
                            <router-view></router-view>
                        </keep-alive>
                    </b-col>
                </b-row>
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
        computed: {
            model () {
                return this.$store.getters["service/courses/byId"]({id: this.id});
            }
        },
        created () {
            this.$store.dispatch("service/courses/loadById", {id: this.id});
        }
    };
</script>

<style lang="scss" scoped>
</style>
