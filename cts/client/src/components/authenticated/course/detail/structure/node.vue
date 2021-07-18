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
        <div :class="{'font-weight-bold': isSelected}">
            <b-row>
                <b-col>
                    <span v-if="item.type === 'block'" @click="toggleOpen" class="mr-2">
                        <b-icon :icon="isOpen ? 'dash-square' : 'plus-square'"/>
                    </span>
                    <span @click="toggleSelection">{{ item.title[0].text }}</span>
                </b-col>
                <b-col cols="auto" class="node-type" @click="toggleSelection">
                    {{ item.type.toUpperCase() }}
                </b-col>
            </b-row>
        </div>
        <template v-if="item.type === 'course' && item.objectives">
            <b-row v-for="(v, k) of item.objectives" :key="k" :class="{'font-weight-bold': k === objSelected}" style="padding-left: 25px;">
                <b-col>
                    <span @click="objectiveSelect(k, v)">{{ v.title[0].text }}</span>
                </b-col>
                <b-col cols="auto" class="node-type" @click="objectiveSelect(k, v)">
                    OBJECTIVE
                </b-col>
            </b-row>
        </template>
        <ul style="list-style: none; padding-left: 25px;" v-if="(item.type === 'block' && isOpen === true) || item.type === 'course'">
            <course-detail-structure-node v-for="(child, index) in item.children" :key="index" :item="child" @node-select="childNodeSelect"></course-detail-structure-node>
        </ul>
    </li>
</template>

<script>
    import {BIcon, BIconPlusSquare, BIconDashSquare} from "bootstrap-vue";

    export default {
        name: "CourseDetailStructureNode",
        components: {
            BIcon,
            /* eslint-disable vue/no-unused-components */
            BIconPlusSquare,
            BIconDashSquare
            /* eslint-enable vue/no-unused-components */
        },
        props: {
            item: {
                type: Object,
                required: true
            }
        },
        data: () => ({
            isOpen: false,
            isSelected: false,
            objSelected: null
        }),
        watch: {
            isSelected (isSelected) {
                this.$emit("node-select", this, isSelected);
            }
        },
        methods: {
            toggleOpen () {
                if (this.item.type === "block") {
                    this.isOpen = ! this.isOpen;
                }
            },
            toggleSelection () {
                this.isSelected = ! this.isSelected;
            },
            select () {
                this.isSelected = true;
            },
            deselect () {
                this.isSelected = false;
            },
            childNodeSelect (node, isSelected) {
                this.$emit("node-select", node, isSelected);
            },
            objectiveSelect (objKey) {
                this.$emit("objective-select", objKey);
                this.objSelected = objKey;
            }
        }
    };
</script>

<style lang="scss" scoped>
    .node-type {
        font-size: smaller;
        color: $gray-600;
    }
</style>
