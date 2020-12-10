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
