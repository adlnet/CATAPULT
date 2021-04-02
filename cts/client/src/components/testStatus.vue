<template>
    <div>
        <b-badge pill :variant="mapping.variant" class="mr-1">
            <b-icon :icon="mapping.icon" scale="1.75" style="margin: 2px;"/>
        </b-badge>
        <span :class="mapping.spanClass">
            {{ mapping.label }}
        </span>
    </div>
</template>

<script>
    import {BIcon, BIconCheck, BIconQuestion, BIconX} from "bootstrap-vue";

    const mappings = {
        "conformant": {
            label: "Conformant",
            icon: "check",
            variant: "success",
            spanClass: "text-success"
        },
        "nonconformant": {
            label: "Non-conformant",
            icon: "x",
            variant: "danger",
            spanClass: "text-danger"
        },
        "pending": {
            label: "Result Pending",
            icon: "question",
            variant: "dark",
            spanClass: ""
        }
    };

    export default {
        name: "TestStatus",
        components: {
            BIcon,
            /* eslint-disable vue/no-unused-components */
            BIconCheck,
            BIconQuestion,
            BIconX
            /* eslint-enable vue/no-unused-components */
        },
        props: {
            status: {
                type: String,
                required: true
            }
        },
        computed: {
            mapping () {
                let result = mappings[this.status];

                if (! result) {
                    console.log(`Unmapped status: '${this.status}'`);
                    result = {
                        label: "Unrecognized",
                        icon: "question",
                        variant: "",
                        spanClass: ""
                    };
                }

                return result;
            }
        }
    };
</script>

<style lang="scss" scoped>
</style>
