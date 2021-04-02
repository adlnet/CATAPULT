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
    <b-row align-h="center">
        <b-col cols="auto">
            <b-form class="">
                <h1>Start a new test</h1>
                <b-form-group label="Course" label-for="course">
                    <template v-if="cache.loading">
                        Loading course list...
                    </template>
                    <template v-else-if="cache.error">
                        Failed to load course list: {{ cache.errMsg }}
                    </template>
                    <b-select
                        v-else
                        id="course"
                        v-model="selected"
                        :options="courses"
                        style="width: auto;"
                    >
                        <template #first>
                            <b-form-select-option :value="null" disabled>Select Course</b-form-select-option>
                        </template>
                    </b-select>
                </b-form-group>
                <b-button class="mr-3" :disabled="selected === null" variant="primary" :to="`/test-new/${selected}`" @click="$root.$emit('bv::toggle::collapse', 'navbar-new-test')">Continue</b-button>
                <b-button @click="$root.$emit('bv::toggle::collapse', 'navbar-new-test')">Cancel</b-button>
            </b-form>
        </b-col>
    </b-row>
</template>

<script>
    import Vuex from "vuex";

    export default {
        name: "NavBarTestNew",
        data: () => ({
            selected: null
        }),
        computed: {
            ...Vuex.mapGetters(
                {
                    cache: "service/courses/defaultCache"
                }
            ),
            courses () {
                return this.cache.items.map(
                    (i) => ({
                        value: i.id,
                        text: i.metadata.structure.course.title[0].text
                    })
                );
            }
        },
        created () {
            this.load();
        },
        methods: {
            ...Vuex.mapActions(
                "service/courses",
                {
                    load: "load"
                }
            )
        }
    };
</script>

<style lang="scss" scoped>
</style>
