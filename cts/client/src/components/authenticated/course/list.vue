<template>
    <b-row>
        <b-col>
            <h2 class="mb-3">Courses</h2>

            <alerts kind="courseList" />

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
                <template #cell(title)="data">
                    <b-link :to="`/courses/${data.item.id}`">
                        {{ data.item.metadata.structure.course.title[0].text }}
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
                        {{ data.value | moment("from", "now") }}
                    </span>
                    <span v-else>
                        Never
                    </span>
                </template>
                <!--
                <template #cell(detailToggle)="row">
                    <b-button size="sm" variant="link" class="detailToggle" @click="row.toggleDetails">
                        <font-awesome-icon v-if="row.detailsShowing" icon="caret-down"></font-awesome-icon>
                        <font-awesome-icon v-else icon="caret-right"></font-awesome-icon>
                    </b-button>
                </template>
                -->
                <template #cell(actions)="row">
                    <b-button size="sm" variant="primary" class="mr-2" :to="`/test-new/${row.item.id}`">Test</b-button>
                    <!-- TODO: need to do confirmation -->
                    <b-button size="sm" variant="outline-danger" @click="drop({item: row.item})">Delete</b-button>
                    <!--
                    <b-dropdown right variant="primary" size="sm" text="Actions">
                        <b-dropdown-item-button @click="launch({courseId: row.item.id})">
                            Launch
                        </b-dropdown-item-button>
                        <b-dropdown-item-button variant="danger" @click="drop({courseId: row.item.id})">
                            Delete
                        </b-dropdown-item-button>
                    </b-dropdown>
                    -->
                </template>
                <!--
                <template #row-details="row">
                    <b-container fluid class="targetRegistrationDetail mb-4">
                        <b-row class="mb-4">
                            <b-col>
                                {{ row.item.id }} Reg details.
                            </b-col>
                        </b-row>
                    </b-container>
                </template>
                -->
            </b-table>
        </b-col>
    </b-row>
</template>

<script>
    import Vuex from "vuex";
    import {BIconSearch} from "bootstrap-vue";
    import alerts from "@/components/alerts";
    import testStatus from "@/components/testStatus";

    export default {
        name: "CourseList",
        components: {
            BIconSearch,
            alerts,
            testStatus
        },
        data: () => ({
            caller: "courses",
            tableFields: [
                /*
                {
                    key: "detailToggle",
                    label: "",
                    class: "text-center"
                },
                */
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
            /*
            cacheProperties () {
                return this.$store.getters["target/coursesCacheProperties"]({caller: this.caller});
            },
            */
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

            /*
            async launch ({courseId}) {
                const launchUrl = await this.$store.dispatch(
                    "target/launchUrl",
                    {
                        courseId: courseId,
                        caller: "courses",
                        createRegistration: false
                    }
                );

                // if the above errors then there will be a warning shown,
                // so this can effectively be silent
                if (launchUrl) {
                    window.open(launchUrl);
                }
            }
            */
        }
    };
</script>

<style lang="scss">
</style>
