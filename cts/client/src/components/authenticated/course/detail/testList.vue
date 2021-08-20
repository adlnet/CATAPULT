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
    <b-row>
        <b-col>
            <alerts kind="courseDetailTestList" />

            <b-table
                :fields="tableFields"
                :items="cache.items"
                :busy="cache.loading"
                primary-key="id"
                show-empty
                empty-text="No tests performed."
                small
                striped
                class="target targetCondensed"
            >
                <template #table-busy>
                    <div class="text-center text-danger my-2">
                        <b-spinner class="align-middle"></b-spinner>
                        <strong>Loading...</strong>
                    </div>
                </template>
                <template #cell(registration)="data">
                    <b-link :to="`/test/${data.item.id}`">
                        {{ data.value }}
                    </b-link>
                </template>
                <template #cell(result)="data">
                    <test-status :status="data.value" />
                </template>
                <template #cell(updatedAt)="data">
                    <span v-if="data.value" v-b-popover.hover="data.value">
                        {{ data.value | moment("from", "now") }}
                    </span>
                    <span v-else>
                        Never
                    </span>
                </template>
                <template #cell(actions)="row">
                    <b-button size="sm" variant="primary" class="mr-2" :to="`/test/${row.item.id}`">Resume</b-button>
                    <b-button size="sm" variant="secondary" @click="download({item: row.item})">Download</b-button>
                </template>
            </b-table>
        </b-col>
    </b-row>
</template>

<script>
    import Vuex from "vuex";
    import alerts from "@/components/alerts";
    import testStatus from "@/components/testStatus";

    export default {
        name: "CourseDetailTestList",
        components: {
            alerts,
            testStatus
        },
        props: {
            id: {
                type: Number,
                required: true
            }
        },
        data: () => ({
            tableFields: [
                {
                    key: "registration",
                    label: "Registration",
                    sortable: true,
                    formatter: (value, key, item) => `${item.metadata.actor.name } (${item.code})`,
                    sortByFormatted: true,
                    class: "w-100"
                },
                {
                    key: "result",
                    label: "Test Result",
                    sortable: true,
                    formatter: (value, key, item) => item.metadata.result,
                    sortByFormatted: true,
                    class: "text-nowrap px-4 align-middle"
                },
                {
                    key: "updatedAt",
                    label: "Last Updated",
                    sortable: true,
                    class: "text-nowrap px-4 align-middle"
                },
                {
                    key: "actions",
                    class: "text-nowrap px-4 align-middle"
                }
            ]
        }),
        computed: {
            cacheKey () {
                return this.$store.getters["service/tests/cacheKey"]({courseId: this.id});
            },
            cache () {
                return this.$store.getters["service/tests/cache"]({cacheKey: this.cacheKey});
            }
        },
        watch: {
            cacheKey () {
                this.load({courseId: this.id});
            }
        },
        mounted () {
            this.load({courseId: this.id});
        },
        methods: {
            ...Vuex.mapActions(
                "service/tests",
                {
                    load: "load"
                }
            ),

            async download ({item}) {
                try {
                    await this.$store.dispatch("service/tests/triggerDownload", {id: item.id});
                }
                catch (ex) {
                    this.$store.dispatch("service/courses/alert", {content: `Failed to trigger download (${item.id}): ${ex}`, kind: "courseDetailTestList"});
                }
            }
        }
    };
</script>

<style lang="scss">
</style>
