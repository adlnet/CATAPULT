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
    <p v-if="! isAdmin">
        Access denied.
    </p>
    <b-row v-else>
        <b-col>
            <h2 class="mb-3">Administration</h2>
            <b-row>
                <b-col>
                    <b-nav tabs class="my-3">
                        <b-nav-item :to="`/admin/`" exact active-class="active">
                            About
                        </b-nav-item>
                        <b-nav-item :to="`/admin/user-list`" active-class="active">
                            Users
                        </b-nav-item>
                    </b-nav>
                    <keep-alive>
                        <router-view></router-view>
                    </keep-alive>
                </b-col>
            </b-row>
        </b-col>
    </b-row>
</template>

<script>
    export default {
        name: "Admin",
        computed: {
            isAdmin () {
                return this.$store.getters["service/apiAccess/isAdmin"]();
            }
        }
    };
</script>

<style lang="scss" scoped>
</style>
