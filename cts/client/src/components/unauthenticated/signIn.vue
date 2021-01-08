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
        <b-form-group label="Email address" label-for="username">
            <b-form-input id="username" v-model="username" />
        </b-form-group>
        <b-form-group label="Password" label-for="password">
            <b-form-input id="password" type="password" v-model="password" />
        </b-form-group>
        <b-form-checkbox id="rememberMe" v-model="rememberMe">
            Remember me
        </b-form-checkbox>
        <b-button @click="doSignIn">
            Log In
        </b-button>
    </b-form>
</template>

<script>
    export default {
        name: "signIn",
        data: () => ({
            username: null,
            password: null,
            rememberMe: false
        }),
        methods: {
            doSignIn () {
                console.log("sign me in bro", this.username, this.password);
            }
        }
    };
</script>

<style lang="scss">
</style>
