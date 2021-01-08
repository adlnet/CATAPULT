<template>
    <b-row>
        <b-col>
            <h2 class="mb-3">Courses</h2>

            <alerts kind="courses" />

            <b-row class="mb-4">
                <b-col>
                    <b-form inline>
                        <label class="col-form-label-sm mr-1">Show</label>
                        <b-form-select size="sm" class="mr-3">
                            <option value="all" selected>all courses</option>
                        </b-form-select>

                        <label class="sr-only" for="search">Search</label>
                        <b-input-group size="sm" class="mr-3">
                            <b-form-input id="search" placeholder="Search...">
                            </b-form-input>
                            <b-input-group-append>
                                <b-button variant="outline-info">
                                    <b-icon-search></b-icon-search>
                                </b-button>
                            </b-input-group-append>
                        </b-input-group>

                        <b-button size="sm" class="mr-1" @click="load({force: true})">
                            Force Reload
                        </b-button>
                    </b-form>
                </b-col>
                <b-col cols="auto" class="d-flex align-items-baseline justify-content-end">
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
                <template #cell(testResult)="data">
                    <template v-if="data.value">
                        <b-badge pill variant="success" class="mr-1">
                            <b-icon-check scale="1.75"/>
                        </b-badge>
                        <span class="text-success">
                            Conformant
                        </span>
                    </template>
                    <template v-else-if="data.value === false">
                        <b-badge pill variant="danger" class="mr-1">
                            <b-icon-x scale="1.75"/>
                        </b-badge>
                        <span class="text-danger">
                            Non-conformant
                        </span>
                    </template>
                    <template v-else>
                        <b-badge pill variant="dark" class="mr-1">
                            <b-icon-question scale="1.75"/>
                        </b-badge>
                        Result Pending
                    </template>
                </template>
                <template #cell(lastTested)="data">
                    <span v-if="data.value" v-b-popover.hover="data.value">
                        {{ data.value | moment("from", "now") }}
                    </span>
                    <span v-else>
                        Never
                    </span>
                </template>
                <template #cell(actions)="row">
                    <b-button size="sm" variant="primary" class="mr-2" @click="test({item: row.item})">Test</b-button>
                    <b-button size="sm" variant="outline-danger" @click="drop({item: row.item})">Delete</b-button>
                </template>
            </b-table>
        </b-col>
    </b-row>
</template>

<script>
    import Vuex from "vuex";
    import {BIconCheck, BIconQuestion, BIconSearch, BIconX} from "bootstrap-vue";
    import alerts from "@/components/alerts";

    export default {
        name: "courses",
        components: {
            BIconCheck,
            BIconQuestion,
            BIconSearch,
            BIconX,
            alerts
        },
        data: () => ({
            caller: "courses",
            tableFields: [
                {
                    key: "title",
                    label: "Title",
                    sortable: true,
                    class: "w-100"
                },
                {
                    key: "testResult",
                    label: "Test Result",
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
                let path = "/courses";

                if (pageNum !== 1) {
                    path += `/${pageNum}`;
                }

                return {path};
            },

            test ({item}) {
                console.log("components:courses::test", item);
            }
        }
    };
</script>

<style lang="scss">
</style>
