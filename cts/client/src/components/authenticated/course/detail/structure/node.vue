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
            <span v-if="item.type === 'block'" @click="toggleOpen" class="mr-2">[{{ isOpen ? '-' : '+' }}]</span>
            <span @click="toggleSelection">{{ item.title[0].text }} ({{ item.type }})</span>
        </div>
        <ul style="list-style: none;" v-if="(item.type === 'block' && isOpen === true) || item.type === 'course'">
            <course-detail-structure-node v-for="(child, index) in item.children" :key="index" :item="child" @node-select="childNodeSelect"></course-detail-structure-node>
        </ul>
    </li>
</template>

<script>
    export default {
        name: "CourseDetailStructureNode",
        props: {
            item: {
                type: Object,
                required: true
            }
        },
        data: () => ({
            isOpen: false,
            isSelected: false
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
            }
        }
    };
</script>

<style lang="scss" scoped>
</style>

