<!--
    Copyright 2020 Rustici Software

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
    <b-col>
        <b-navbar fixed sticky>
            <b-navbar-brand class="title">
                catapult
            </b-navbar-brand>

            <b-navbar-nav>
                <b-nav-text>
                    <b-breadcrumb>
                        <b-breadcrumb-item to="/">
                            Home
                        </b-breadcrumb-item>
                    </b-breadcrumb>
                </b-nav-text>
            </b-navbar-nav>

            <b-navbar-nav class="ml-auto">
                <b-nav-form>
                    <b-button to="/course-new/upload" variant="primary" class="mr-2">New Course</b-button>
                    <b-button v-b-toggle.navbar-new-test :disabled="newTestContentIsShown" variant="primary">New Test</b-button>
                    <b-nav-item-dropdown right no-caret class="user-menu-dropdown h2 mb-2">
                        <template #button-content>
                            <b-icon-person-fill class="rounded-circle bg-info" scale="0.75" variant="light" />
                        </template>
                        <b-dropdown-item :to="{path: '/requirements'}">Spec Requirements</b-dropdown-item>
                        <b-dropdown-item v-if="isAdmin" :to="{path: '/admin'}">Administration</b-dropdown-item>
                        <b-dropdown-item @click="doSignOut">Sign Out</b-dropdown-item>
                    </b-nav-item-dropdown>
                </b-nav-form>
            </b-navbar-nav>
        </b-navbar>
        <b-navbar fixed sticky>
            <b-collapse id="navbar-new-test" class="w-100">
                <!--
                    use the v-if here to prevent creation/mounting of the component because
                    it triggers a load of the course list which would always happen when the
                    nav bar is rendered (which is always) and that load isn't always necessary
                -->
                <test-new v-if="newTestContentIsShown" />
            </b-collapse>
        </b-navbar>
    </b-col>
</template>

<script>
    import {BIconPersonFill} from "bootstrap-vue";
    import testNew from "@/components/authenticated/navBar/testNew";

    export default {
        name: "NavBar",
        components: {
            BIconPersonFill,
            testNew
        },
        data: () => ({
            newTestContentIsShown: false
        }),
        computed: {
            isAdmin () {
                return this.$store.getters["service/apiAccess/isAdmin"]();
            }
        },
        mounted () {
            //
            // listen for the collapse event so we can set a local value
            // as to whether the new test content form is currently being
            // displayed so that we can disable the button that toggles
            // display of the content, can't use refs because they are
            // handled too late in the cycle
            //
            this.$root.$on(
                "bv::collapse::state",
                (collapseId, isJustShown) => {
                    this.newTestContentIsShown = isJustShown;
                }
            );
        },
        methods: {
            async doSignOut () {
                try {
                    await this.$store.dispatch("service/apiAccess/clearCredential");
                }
                catch (ex) {
                    console.log(`Failed call to clear credential: ${ex}`);
                }
            }
        }
    };
</script>

<style lang="scss" scoped>
    .navbar {
        padding-right: .5rem;
        padding-top: 0px;
        padding-bottom: 0px;
    }

    .navbar-light .title,
    .navbar-light .title:focus,
    .navbar-light .title:hover {
        font-size: 2.5rem;
        padding: 0px;
        color: $gray-600;

        &::first-letter {
            color: $primary;
        }
    }

    ol.breadcrumb {
        background-color: inherit;
        margin-bottom: 0px;

        a {
            text-decoration: none;
        }
    }

    .user-menu-dropdown {
        margin-bottom: 0px !important;
    }

    #navbar-new-test {
        margin-top: 5px;
        border-top: 1px solid $gray-300;
        padding: 30px;
    }
</style>
