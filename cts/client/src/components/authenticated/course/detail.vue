<!--
    Copyright 2021 Rustici Software

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
 -->
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
                        <b-button id="start-delete" variant="outline-danger">Delete</b-button>
                        <b-popover :show.sync="showConfirmDelete" target="start-delete" placement="bottomleft">
                            <template #title>Confirm Course Deletion</template>

                            <p>
                                Deleting this course will also delete all associated test data. Do you wish to delete the course?
                            </p>
                            <div class="text-center">
                                <b-button size="sm" variant="danger" class="mr-2" @click="doDelete">Confirm</b-button>
                                <b-button size="sm" variant="primary" @click="showConfirmDelete = !showConfirmDelete">Cancel</b-button>
                            </div>
                        </b-popover>
                    </b-col>
                </b-row>
                <b-row>
                    <b-col>
                        LMS ID: {{ model.item.metadata.structure.course.lmsId }}
                        <br>
                        Publisher ID: {{ model.item.metadata.structure.course.id }}
                        <br>
                        Imported: {{ model.item.createdAt | moment("from", "now") }}
                        <br>
                        <b-nav tabs class="my-3">
                            <b-nav-item :to="`/course/${id}`" exact active-class="active">
                                Conformance Tests
                            </b-nav-item>
                            <b-nav-item :to="`/course/${id}/structure`" active-class="active">
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
    import Vuex from "vuex";

    export default {
        name: "CourseDetail",
        props: {
            id: {
                type: Number,
                required: true
            }
        },
        data: () => ({
            showConfirmDelete: false
        }),
        computed: {
            model () {
                return this.$store.getters["service/courses/byId"]({id: this.id});
            }
        },
        created () {
            this.$store.dispatch("service/courses/loadById", {id: this.id});
        },
        methods: {
            ...Vuex.mapActions(
                "service/courses",
                {
                    drop: "delete"
                }
            ),

            async doDelete () {
                try {
                    const result = await this.drop(
                        {
                            item: this.model.item
                        }
                    );

                    if (result) {
                        this.$router.push("/");
                    }
                }
                catch (ex) {
                    console.log(`Failed call to delete course: ${ex}`);
                }
            }
        }
    };
</script>

<style lang="scss" scoped>
</style>
