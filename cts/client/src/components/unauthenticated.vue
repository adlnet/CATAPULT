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
        <b-card class="ml-auto mr-auto" style="padding-left: 80px; padding-right: 80px; margin: 40px; width: 40%;">
            <div class="logo text-center">
                catapult
            </div>
            <p class="about text-center">
                cmi5 conformance test suite
            </p>
            <template v-if="isBootstrapped">
                <h2 class="my-3">
                    Please sign in.
                </h2>
                <sign-in />
            </template>
            <template v-else>
                <h2 class="my-3">
                    Initialize Service Access
                </h2>
                <bootstrap />
            </template>
        </b-card>
    </b-col>
</template>

<script>
    import Vuex from "vuex";
    import signIn from "@/components/unauthenticated/signIn";
    import bootstrap from "@/components/unauthenticated/bootstrap";

    export default {
        name: "unauthenticated",
        components: {
            signIn,
            bootstrap
        },
        computed: {
            ...Vuex.mapState(
                "service/apiAccess",
                {
                    isBootstrapped: (state) => state.isBootstrapped
                }
            )
        },
    };
</script>

<style lang="scss">
    .logo {
        font-size: 4rem;
        padding: 0px;
        color: $gray-600;
        line-height: 1;

        &::first-letter {
            color: $primary;
        }
        min-width: 230px;
    }

    .about {
        font-size: 90%;
        color: $gray-600;
    }
</style>
