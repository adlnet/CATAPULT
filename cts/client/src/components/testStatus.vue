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
    <div>
        <b-badge pill :variant="mapping.variant" class="mr-1">
            <b-icon :icon="mapping.icon" scale="1.75" style="margin: 2px;" :aria-label="mapping.label"/>
        </b-badge>
        <span v-if="label" :class="mapping.spanClass">
            {{ mapping.label }}
        </span>
    </div>
</template>

<script>
    import {BIcon, BIconCheck, BIconDash, BIconQuestion, BIconX} from "bootstrap-vue";

    const mappings = {
        "conformant": {
            label: "Conformant",
            icon: "check",
            variant: "success",
            spanClass: "text-success"
        },
        "non-conformant": {
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
        },
        "not-started": {
            label: "Not Started",
            icon: "dash",
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
            BIconDash,
            BIconQuestion,
            BIconX
            /* eslint-enable vue/no-unused-components */
        },
        props: {
            status: {
                type: String,
                required: true
            },
            label: {
                type: Boolean,
                required: false,
                default: true
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
