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
            <ul style="list-style: none;">
                <structure-node key="course" :item="structure.course" @node-select="nodeSelect"></structure-node>
            </ul>
        </b-col>
        <b-col>
            <template v-if="selectedNode">
                <b-card>
                    <template #header>
                        <b-row>
                            <b-col>
                                <h4 style="margin-bottom: 0px;">{{ selectedNode.item.title[0].text }}</h4>
                            </b-col>
                            <b-col cols="auto" class="text-right" style="text-transform: capitalize;">
                                {{ selectedNode.item.type }}
                            </b-col>
                        </b-row>
                    </template>

                    <div>
                        <h5>Properties</h5>
                        <b-table-simple small borderless striped>
                            <b-tbody>
                                <b-tr>
                                    <b-td class="text-nowrap">Publisher ID: </b-td>
                                    <b-td>{{ selectedNode.item.id }}</b-td>
                                </b-tr>
                                <b-tr>
                                    <b-td class="text-nowrap">LMS ID: </b-td>
                                    <b-td>{{ selectedNode.item.lmsId }}</b-td>
                                </b-tr>
                                <template v-if="selectedNode.item.type === 'au'">
                                    <b-tr>
                                        <b-td>URL: </b-td>
                                        <b-td>{{ selectedNode.item.url }}</b-td>
                                    </b-tr>
                                    <b-tr>
                                        <b-td>launchMethod: </b-td>
                                        <b-td>{{ selectedNode.item.launchMethod }}</b-td>
                                    </b-tr>
                                    <b-tr>
                                        <b-td>moveOn: </b-td>
                                        <b-td>{{ selectedNode.item.moveOn }}</b-td>
                                    </b-tr>
                                    <b-tr>
                                        <b-td>activityType: </b-td>
                                        <b-td>{{ selectedNode.item.activityType }}</b-td>
                                    </b-tr>
                                    <b-tr>
                                        <b-td>masteryScore: </b-td>
                                        <b-td>{{ selectedNode.item.masteryScore }}</b-td>
                                    </b-tr>
                                    <b-tr>
                                        <b-td>launchParameters: </b-td>
                                        <b-td>{{ selectedNode.item.launchParameters }}</b-td>
                                    </b-tr>
                                </template>
                            </b-tbody>
                        </b-table-simple>
                    </div>

                    <div class="mt-3">
                        <h5>Title</h5>
                        <span v-for="(title) in selectedNode.item.title" :key="title.lang">
                            {{ title.lang }}: {{ title.text }}<br>
                        </span>
                    </div>

                    <div class="mt-3">
                        <h5>Description</h5>
                        <span v-for="(desc) in selectedNode.item.description" :key="desc.lang">
                            {{ desc.lang }}: {{ desc.text }}<br>
                        </span>
                    </div>
                </b-card>
            </template>
            <template v-else>
                Select course stucture node at left.
            </template>
        </b-col>
    </b-row>
</template>

<script>
    import structureNode from "./structure/node";

    export default {
        name: "CourseDetailStructure",
        components: {
            structureNode
        },
        props: {
            id: {
                type: String,
                required: true
            }
        },
        data: () => ({
            selectedNode: null
        }),
        computed: {
            model () {
                return this.$store.getters["service/courses/byId"]({id: this.id});
            },
            structure () {
                return this.model.item.metadata.structure;
            }
        },
        methods: {
            nodeSelect (node, isSelected) {
                this.$emit("nodeSelect", node, isSelected)

                if (isSelected) {
                    if (this.selectedNode !== null) {
                        this.selectedNode.deselect()
                    }
                    this.selectedNode = node
                }
                else if (node === this.selectedNode) {
                    this.selectedNode = null
                }
            }
        }
    };
</script>

<style lang="scss" scoped>
</style>
