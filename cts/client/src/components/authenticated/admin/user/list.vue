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
            <h5 class="mb-3">Users</h5>

            <alerts kind="adminUserList" />

            <b-row class="mb-4">
                <b-col>
                    <b-form inline>
                        <b-button size="sm" class="mr-1" @click="load({force: true})">
                            Force Reload
                        </b-button>
                        <b-button size="sm" class="mr-1" @click="toggleShowAdd">
                            Add
                        </b-button>
                    </b-form>
                </b-col>
                <b-col cols="auto" class="d-flex align-items-baseline justify-content-end">
                    <b-spinner v-if="cache.loadingMore" small></b-spinner>
                    <b-col cols="auto">
                        <b-form inline>
                            <label class="col-form-label-sm mr-1" for="tablePerPage">Users per page</label>
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
                        aria-controls="usersTable"
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

            <b-row v-if="showAdd" class="mb-3">
                <b-col>
                    <h5>Add User</h5>
                    <b-form>
                        <b-form-group label="Username">
                            <b-form-input type="text" size="sm" v-model="username" style="width: 40em;"></b-form-input>
                        </b-form-group>
                        <b-form-group label="Password">
                            <b-form-input type="password" size="sm" v-model="password" style="width: 40em;"></b-form-input>
                        </b-form-group>
                        <b-form-group>
                            <b-form-checkbox inline size="sm" v-model="makeAdmin" :value="true" :unchecked-value="false">Make admin?</b-form-checkbox>
                        </b-form-group>
                        <b-button variant="primary" size="sm" :disabled="username === '' || password === ''" class="mr-2" @click="doCreateUser">
                            Create User
                        </b-button>
                        <b-button variant="danger" size="sm" @click="toggleShowAdd">
                            Cancel
                        </b-button>
                    </b-form>
                </b-col>
            </b-row>

            <b-table
                :fields="tableFields"
                :items="cache.items"
                :busy="cache.loading"
                primary-key="id"
                show-empty
                empty-text="No users to list (remove filter?)."
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
                <template #cell(username)="data">
                    {{ data.item.username }}
                </template>
                <template #cell(roleList)="data">
                    {{ data.item.roles.join(", ") }}
                </template>
                <template #cell(createdAt)="data">
                    <span v-if="data.value" v-b-popover.hover="data.value">
                        {{ data.value | moment("from", "now") }}
                    </span>
                </template>
                <template #cell(updatedAt)="data">
                    <span v-if="data.value" v-b-popover.hover="data.value">
                        {{ data.value | moment("from", "now") }}
                    </span>
                </template>
                <template #cell(actions)="row">
                    <b-button size="sm" variant="outline-danger" @click="row.toggleDetails">Delete</b-button>
                </template>
                <template #row-details="row">
                    <div class="text-right">
                        Deleting this user will also delete all associated test data. Do you wish to delete the user?
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

    export default {
        name: "AdminUserList",
        components: {
            alerts
        },
        data: () => ({
            tableFields: [
                {
                    key: "username",
                    label: "Username",
                    sortable: true
                },
                {
                    key: "roleList",
                    label: "Roles"
                },
                {
                    key: "createdAt",
                    label: "Created",
                    sortable: true,
                    class: "text-nowrap px-4 align-middle"
                },
                {
                    key: "updatedAt",
                    label: "Updated",
                    sortable: true,
                    class: "text-nowrap px-4 align-middle"
                },
                {
                    key: "actions",
                    class: "text-nowrap px-4 align-middle"
                }
            ],
            tablePerPage: 25,
            tableDesiredPage: null,
            showAdd: false,
            username: "",
            password: "",
            makeAdmin: false
        }),
        computed: {
            ...Vuex.mapGetters(
                {
                    cacheKey: "service/users/defaultCacheKey",
                    cache: "service/users/defaultCache"
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
                "service/users",
                {
                    load: "load",
                    create: "create",
                    drop: "delete"
                }
            ),

            paginationLinkGen (pageNum) {
                if (pageNum === 1) {
                    return "/admin/user-list";
                }

                return `/admin/user-list/{pageNum}`;
            },

            isCurrentUser (user) {
                if (user.id === this.$store.getters["service/apiAccess/current"].id) {
                    return true;
                }

                return false;
            },

            toggleShowAdd () {
                this.showAdd = ! this.showAdd;
            },

            async doCreateUser () {
                const result = this.create({username: this.username, password: this.password, roles: this.makeAdmin ? ["admin"] : []});

                if (result) {
                    this.username = "";
                    this.password = "";
                }
            }
        }
    };
</script>

<style lang="scss">
</style>
