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
    <b-col class="d-flex flex-column">
        <b-row class="nav-wrapper mb-3">
            <nav-bar />
        </b-row>
        <b-row class="flex-fill">
            <b-col>
            </b-col>
            <b-col cols="10" class="d-flex flex-column">
                <router-view/>
            </b-col>
            <b-col>
            </b-col>
        </b-row>
    </b-col>
</template>

<script>
    import navBar from "@/components/authenticated/navBar";

    export default {
        name: "authenticated",
        components: {
            navBar
        },
        data: () => ({
            timer: ""
        }),
        created () {
            this.timer = setInterval(this.expireLogin, 1000);
        },
        destroyed () {
            clearInterval(this.timer);
        },
        methods: {
            expireLogin () {
                if (this.$store.state.service.apiAccess.expiresAt && this.$store.state.service.apiAccess.expiresAt < new Date().toISOString()) {
                    this.$store.dispatch("alerts/add", {content: "Your session has expired, please sign in again"},{root: true});
                    this.$store.dispatch("service/apiAccess/clearCredentialTimeout");
                }
            }
        }
    };
</script>

<style lang="scss" scoped>
    .nav-wrapper {
        // use a box-shadow to give us our gradient bottom border
        box-shadow: 0 4px 6px -6px #000000;
    }
</style>
