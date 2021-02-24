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

