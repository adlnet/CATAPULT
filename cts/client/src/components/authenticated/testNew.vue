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
    <b-row align-h="center">
        <b-col cols="auto">
            <b-form class="">
                <h1>Start a new test</h1>
                <b-form-group label="Course" label-for="course">
                    <b-select id="course" v-model="selected" :options="courses" value-field="id" text-field="title" style="width: auto;">
                    </b-select>
                </b-form-group>
                <b-button class="mr-3" :disabled="selected === null" variant="primary">Continue</b-button>
                <b-button @click='$root.$emit("bv::toggle::collapse", "navbar-new-test")'>Cancel</b-button>
            </b-form>
        </b-col>
    </b-row>
</template>

<script>
    export default {
        name: "test-new",
        data: () => ({
            selected: null,
            courses: [
                {
                    id: null,
                    title: "-- Select a course --"
                },
                {
                    id: "sample-hard-coded-course",
                    title: "Sample Hard Coded Course"
                }
            ]
        })
    };
</script>

<style lang="scss" scoped>
</style>
