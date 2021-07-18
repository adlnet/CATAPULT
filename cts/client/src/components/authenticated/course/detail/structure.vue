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
        <b-col cols="5">
            <ul style="list-style: none;">
                <structure-node key="course" :item="structure.course" ref="courseStructureNode" @node-select="nodeSelect" @objective-select="objectiveSelect"></structure-node>
            </ul>
        </b-col>
        <b-col cols="7">
            <template v-if="selectedNode">
                <b-card>
                    <template #header>
                        <b-row>
                            <b-col>
                                <h4 style="margin-bottom: 0px;">{{ selectedNode.item.title[0].text }}</h4>
                            </b-col>
                            <b-col cols="auto" class="text-right" style="text-transform: capitalize;">
                                {{ selectedNode.item.type === "au" ? "AU" : selectedNode.item.type }}
                            </b-col>
                        </b-row>
                    </template>

                    <div>
                        <h5>Properties</h5>
                        <b-table-simple small borderless striped class="detail-structure-node">
                            <b-tbody>
                                <b-tr v-if="selectedNode.item.type === 'objective'">
                                    <b-td class="property-label">ID: </b-td>
                                    <b-td>{{ selectedNode.item.id }}</b-td>
                                </b-tr>
                                <template v-else>
                                    <b-tr>
                                        <b-td class="property-label">Publisher ID: </b-td>
                                        <b-td>{{ selectedNode.item.id }}</b-td>
                                    </b-tr>
                                    <b-tr>
                                        <b-td class="property-label">LMS ID: </b-td>
                                        <b-td>{{ selectedNode.item.lmsId }}</b-td>
                                    </b-tr>
                                </template>
                                <template v-if="selectedNode.item.type === 'au'">
                                    <b-tr>
                                        <b-td class="property-label">URL: </b-td>
                                        <b-td>{{ selectedNode.item.url }}</b-td>
                                    </b-tr>
                                    <b-tr>
                                        <b-td class="property-label">launchMethod: </b-td>
                                        <b-td>{{ selectedNode.item.launchMethod }}</b-td>
                                    </b-tr>
                                    <b-tr>
                                        <b-td class="property-label">moveOn: </b-td>
                                        <b-td>{{ selectedNode.item.moveOn }}</b-td>
                                    </b-tr>
                                    <b-tr>
                                        <b-td class="property-label">activityType: </b-td>
                                        <b-td>{{ selectedNode.item.activityType }}</b-td>
                                    </b-tr>
                                    <b-tr>
                                        <b-td class="property-label">masteryScore: </b-td>
                                        <b-td>{{ selectedNode.item.masteryScore }}</b-td>
                                    </b-tr>
                                    <b-tr>
                                        <b-td class="property-label">launchParameters: </b-td>
                                        <b-td>{{ selectedNode.item.launchParameters }}</b-td>
                                    </b-tr>
                                </template>
                            </b-tbody>
                        </b-table-simple>
                    </div>

                    <div class="mt-3">
                        <h5>Title</h5>
                        <span v-for="(title) in selectedNode.item.title" :key="title.lang">
                            <span class="lang-label">{{ title.lang }}:</span> {{ title.text }}<br>
                        </span>
                    </div>

                    <div class="mt-3">
                        <h5>Description</h5>
                        <span v-for="(desc) in selectedNode.item.description" :key="desc.lang">
                            <span class="lang-label">{{ desc.lang }}:</span> {{ desc.text }}<br>
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
                type: Number,
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
                if (isSelected) {
                    if (this.selectedNode !== null) {
                        this.selectedNode.deselect();
                    }
                    this.selectedNode = node;
                }
                else if (node === this.selectedNode) {
                    this.selectedNode = null;
                }
            },

            objectiveSelect (objKey) {
                if (this.selectedNode !== null) {
                    this.selectedNode.deselect();
                }

                const self = this;

                this.selectedNode = {
                    item: {
                        type: "objective",
                        id: objKey,
                        ...this.model.item.metadata.structure.course.objectives[objKey]
                    },
                    deselect: () => {
                        self.$refs.courseStructureNode.objSelected = null;
                    }
                };
            }
        }
    };
</script>

<style lang="scss" scoped>
    .detail-structure-node {
        td {
            word-break: break-all
        }
    }
    .property-label {
        white-space: nowrap;
    }
    .lang-label {
        color: $gray-600;
    }
</style>
