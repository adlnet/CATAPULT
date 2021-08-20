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
    <b-row class="flex-fill">
        <b-col class="d-flex flex-column">
            <b-form-group
                id="courseNew-xmlEditor"
                label="Enter course structure XML string to validate and import."
                class="flex-fill d-flex flex-column"
            >
                <b-form-textarea id="courseStructureEntry" v-model="structure" class="flex-fill textarea-fill" no-resize>
                </b-form-textarea>
            </b-form-group>
            <div class="text-center mb-3">
                <b-button variant="primary" :disabled="structure === ''" @click="doImport">
                    Import
                </b-button>
            </div>
        </b-col>
    </b-row>
</template>

<script>
    import Vuex from "vuex";

    export default {
        name: "CourseNewXmlEditor",
        data: () => ({
            structure: ""
        }),
        methods: {
            ...Vuex.mapActions(
                "service/courses",
                [
                    "import"
                ]
            ),

            async doImport () {
                try {
                    const id = await this.import(
                        {
                            body: this.structure,
                            contentType: "text/xml"
                        }
                    );

                    if (id === null) {
                        return;
                    }

                    this.structure = "";

                    this.$router.push(`/course/${id}`);
                }
                catch (ex) {
                    // failing the import should have already posted an alert
                    console.log(`Failed call to import: ${ex}`);
                }
            }
        }
    };
</script>

<style lang="scss">
    .textarea-fill {
        height: calc(100vh - 330px) !important;
    }

    #courseNew-xmlEditor {
        div {
            display: flex;
            flex: 1 1 auto;
            flex-direction: column;
        }
    }
</style>
