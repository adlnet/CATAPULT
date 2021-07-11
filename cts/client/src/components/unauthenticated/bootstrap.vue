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
    <b-form @submit.prevent="doBootstrap">
        <b-alert :show="error" variant="danger">
            {{ errMsg }}
        </b-alert>

        <p>
            There are no users currently in the service. This form will allow you to setup the first user account. Once the service is initialized it can't be done again without clearing all data and creating a new first user, this means you MUST keep track of the username and password set now.
        </p>

        <b-form-group label="Username" label-for="username">
            <b-form-input id="username" v-model="username" />
        </b-form-group>
        <b-form-group label="Password" label-for="password">
            <b-input-group>
                <b-form-input id="password" :type="passwordVisible ? 'text' : 'password'" v-model="password" />
                <b-input-group-append>
                    <b-button variant="outline-primary" style="border-color: #c6cace; font-color: #c6cace;" :pressed="passwordVisible" @click="togglePasswordVisibility">
                        <b-icon-eye />
                    </b-button>
                </b-input-group-append>
            </b-input-group>
        </b-form-group>
        <b-button :disabled="username === '' || password === ''" variant="primary" class="w-100 mt-3" type="submit">
            Initialize First User
        </b-button>
    </b-form>
</template>

<script>
    import Vuex from "vuex";
    import {BIconEye} from "bootstrap-vue";

    export default {
        name: "initialize",
        components: {
            BIconEye
        },
        data: () => ({
            username: "",
            password: "",
            passwordVisible: false
        }),
        computed: {
            ...Vuex.mapState(
                "service/apiAccess",
                {
                    error: (state) => state.error,
                    errMsg: (state) => state.errMsg
                }
            )
        },
        methods: {
            async doBootstrap () {
                try {
                    await this.$store.dispatch(
                        "service/apiAccess/bootstrap",
                        {
                            username: this.username,
                            password: this.password
                        }
                    );
                }
                catch (ex) {
                    console.log(`Failed call to initialize: ${ex}`);
                }
            },
            togglePasswordVisibility () {
                this.passwordVisible = ! this.passwordVisible;
            }
        }
    };
</script>

<style lang="scss">
</style>
