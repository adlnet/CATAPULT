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
    <li>
        <b-row class="result-node">
            <b-col>
                <span v-if="item.type === 'course' || item.type === 'block'" @click="toggleOpen" class="mr-2">
                    <b-icon :icon="isOpen ? 'dash-square' : 'plus-square'"/>
                </span>
                <span>{{ item.title[0].text }}</span>
            </b-col>
            <b-col cols="auto">
                <test-status v-if="item.type === 'course'" :status="courseResult" :label="false" />
                <test-status v-else-if="item.type === 'au'" :status="auList[item.auIndex].result" :label="false" />
            </b-col>
        </b-row>
        <ul style="list-style: none; padding-left: 25px;" v-if="isOpen">
            <test-detail-structure-node v-for="(child, index) in item.children" :key="index" :item="child" :auList="auList"></test-detail-structure-node>
        </ul>
    </li>
</template>

<script>
    import {BIcon, BIconPlusSquare, BIconDashSquare} from "bootstrap-vue";
    import testStatus from "@/components/testStatus";

    export default {
        name: "TestDetailStructureNode",
        components: {
            BIcon,
            /* eslint-disable vue/no-unused-components */
            BIconPlusSquare,
            BIconDashSquare,
            /* eslint-enable vue/no-unused-components */
            testStatus
        },
        props: {
            item: {
                type: Object,
                required: true
            },
            courseResult: {
                type: String,
                required: false
            },
            auList: {
                type: Array,
                required: true
            }
        },
        data: () => ({
            isOpen: false
        }),
        methods: {
            toggleOpen () {
                if (this.item.type === "course" || this.item.type === "block") {
                    this.isOpen = ! this.isOpen;
                }
            }
        }
    };
</script>

<style lang="scss" scoped>
    .result-node {
        padding-bottom: 4px;
    }

    .node-type {
        font-size: smaller;
        color: $gray-600;
    }
</style>
