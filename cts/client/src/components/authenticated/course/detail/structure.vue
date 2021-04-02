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
                        ID: {{ selectedNode.item.id }}
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
