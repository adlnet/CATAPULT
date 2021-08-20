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
    <b-container fluid class="d-flex flex-column p-0 main-container">
        <b-row v-if="isSignedIn" class="flex-fill" no-gutters>
            <authenticated />
        </b-row>
        <b-row v-else class="flex-fill unathenticated-row" no-gutters>
            <unauthenticated />
        </b-row>
    </b-container>
</template>

<script>
    import Vuex from "vuex";
    import authenticated from "@/components/authenticated";
    import unauthenticated from "@/components/unauthenticated";

    export default {
        name: "app",
        components: {
            authenticated,
            unauthenticated
        },
        computed: {
            ...Vuex.mapState(
                "service/apiAccess",
                {
                    isSignedIn: (state) => state.access
                }
            )
        }
    };
</script>

<style lang="scss" scoped>
.main-container {
    overflow-x: hidden
}

.unathenticated-row {
    background-color: #94a9c8;
    min-height: 100vh;
}
</style>
