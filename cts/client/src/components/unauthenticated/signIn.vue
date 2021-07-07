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
    <b-form>
        <b-alert :show="error" variant="danger">
            {{ errMsg }}
        </b-alert>

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
        <b-form-checkbox id="keepSignedIn" v-model="keepSignedIn">
            Keep me signed in
        </b-form-checkbox>
        <b-button :disabled="username === '' || password === ''" variant="primary" class="w-100 mt-3" @click="doSignIn">
            Sign In
        </b-button>
    </b-form>
</template>

<script>
    import Vuex from "vuex";
    import {BIconEye} from "bootstrap-vue";

    export default {
        name: "apiAccess",
        components: {
            BIconEye
        },
        data: () => ({
            username: "",
            password: "",
            keepSignedIn: false,
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
            async doSignIn () {
                try {
                    await this.$store.dispatch(
                        "service/apiAccess/storeCredential",
                        {
                            username: this.username,
                            password: this.password,
                            storeCookie: this.keepLoggedIn
                        }
                    );
                }
                catch (ex) {
                    console.log(`Failed call to init credential: ${ex}`);
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
