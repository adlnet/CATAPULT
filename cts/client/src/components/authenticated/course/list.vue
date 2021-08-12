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
            <h2 class="mb-3">Courses</h2>

            <alerts kind="courseList" />

            <b-row class="mb-4">
                <b-col class="pl-0 d-flex align-items-baseline">
                    <b-spinner v-if="cache.loadingMore" small></b-spinner>
                    <b-col cols="auto">
                        <b-form inline>
                            <label class="col-form-label-sm mr-1" for="tablePerPage">Courses per page</label>
                            <b-form-select v-model="tablePerPage" size="sm">
                                <option>10</option>
                                <option>25</option>
                                <option>50</option>
                                <option>100</option>
                            </b-form-select>
                        </b-form>
                    </b-col>
                    <b-pagination-nav
                        v-if="tableNumberOfPages > 1"
                        v-model="tableCurrentPage"
                        :number-of-pages="tableNumberOfPages"
                        :limit="10"
                        size="sm"
                        aria-controls="coursesTable"
                        class="mr-1 ml-2"
                        :link-gen="paginationLinkGen"
                        use-router
                    >
                    </b-pagination-nav>
                    <b-button v-if="cache.more" size="sm" @click="load({fetchMore: true})">
                        Load More
                    </b-button>
                </b-col>
                <b-col cols="auto" class="d-flex align-items-baseline justify-content-end">
                    <b-button size="sm" class="mr-1" @click="load({force: true})">
                        Reload
                    </b-button>
                </b-col>
            </b-row>

            <b-table
                :fields="tableFields"
                :items="cache.items"
                :busy="cache.loading"
                primary-key="id"
                show-empty
                empty-text="No courses imported."
                small
                striped
                :per-page="tablePerPage"
                :current-page="tableCurrentPage"
                class="target targetCondensed"
            >
                <template #table-busy>
                    <div class="text-center text-danger my-2">
                        <b-spinner class="align-middle"></b-spinner>
                        <strong>Loading...</strong>
                    </div>
                </template>
                <template #cell(title)="data">
                    <b-link :to="`/course/${data.item.id}`">
                        {{ data.value }}
                    </b-link>
                </template>
                <template #cell(testResult)="data">
                    <test-status :status="data.value" />
                </template>
                <template #cell(createdAt)="data">
                    <span v-if="data.value" v-b-popover.hover="data.value">
                        {{ data.value | moment("from", "now") }}
                    </span>
                </template>
                <template #cell(lastTested)="data">
                    <span v-if="data.value" v-b-popover.hover="data.value">
                        <b-link :to="`/test/${data.item.testId}`">
                            {{ data.value | moment("from", "now") }}
                        </b-link>
                    </span>
                    <span v-else>
                        Never
                    </span>
                </template>
                <template #cell(actions)="row">
                    <b-button size="sm" variant="primary" class="mr-2" :to="`/test-new/${row.item.id}`">Test</b-button>
                    <b-button size="sm" variant="outline-danger" @click="row.toggleDetails">Delete</b-button>
                </template>
                <template #row-details="row">
                    <div class="text-right">
                        Deleting this course will also delete all associated test data. Do you wish to delete the course?
                        <b-button size="sm" variant="danger" class="mx-2" @click="drop({item: row.item})">Delete</b-button>
                        <b-button size="sm" variant="primary" class="mr-3" @click="row.toggleDetails">Cancel</b-button>
                    </div>
                </template>
            </b-table>
        </b-col>
    </b-row>
</template>

<script>
    import Vuex from "vuex";
    import alerts from "@/components/alerts";
    import testStatus from "@/components/testStatus";

    export default {
        name: "CourseList",
        components: {
            alerts,
            testStatus
        },
        data: () => ({
            caller: "courses",
            tableFields: [
                {
                    key: "title",
                    label: "Title",
                    sortable: true,
                    formatter: (value, key, item) => item.metadata.structure.course.title[0].text,
                    sortByFormatted: true,
                    class: "w-100"
                },
                {
                    key: "testResult",
                    label: "Test Result",
                    sortable: true,
                    class: "text-nowrap px-4 align-middle"
                },
                {
                    key: "createdAt",
                    label: "Imported",
                    sortable: true,
                    class: "text-nowrap px-4 align-middle"
                },
                {
                    key: "lastTested",
                    label: "Last Tested",
                    sortable: true,
                    class: "text-nowrap px-4 align-middle"
                },
                {
                    key: "actions",
                    class: "text-nowrap px-4 align-middle"
                }
            ],
            tablePerPage: 25,
            tableDesiredPage: null
        }),
        computed: {
            ...Vuex.mapGetters(
                {
                    cacheKey: "service/courses/defaultCacheKey",
                    cache: "service/courses/defaultCache"
                }
            ),
            tableNumberOfPages () {
                return Math.ceil(this.cache.items.length / this.tablePerPage);
            },
            tableCurrentPage: {
                get () {
                    return this.tableDesiredPage <= this.tableNumberOfPages ? this.tableDesiredPage : null;
                },
                set (newValue) {
                    this.tableDesiredPage = newValue;
                }
            }
        },
        watch: {
            cacheKey () {
                this.load();
            }
        },
        mounted () {
            this.load();
        },
        beforeRouteUpdate (to, from, next) {
            this.tableDesiredPage = to.params.initPage <= this.tableNumberOfPages ? to.params.initPage : null;

            next();
        },
        methods: {
            ...Vuex.mapActions(
                "service/courses",
                {
                    load: "load",
                    drop: "delete"
                }
            ),

            paginationLinkGen (pageNum) {
                if (pageNum === 1) {
                    return "/";
                }

                return `/${pageNum}`;
            },

            test ({item}) {
                console.log("components:courses::test", item);
            }
        }
    };
</script>

<style lang="scss">
</style>
