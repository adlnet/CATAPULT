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
            <b-form-group
                id="courseNew-upload"
                label="Select a course structure file or course package to upload."
                description="Course structure XML files (cmi5.xml) and cmi5 course packages in ZIP format are supported."
            >
                <b-form-file v-model="file" id="courseNew-upload-file" accept=".xml, .zip" style="width: 70%;">
                </b-form-file>
            </b-form-group>

            <b-button variant="primary" :disabled="file === null" @click="doUpload">
                Continue
            </b-button>
        </b-col>
    </b-row>
</template>

<script>
    import Vuex from "vuex";

    export default {
        name: "CourseNewUpload",
        data: () => ({
            file: null
        }),
        methods: {
            ...Vuex.mapActions(
                "service/courses",
                [
                    "import"
                ]
            ),

            async doUpload () {
                try {
                    const id = await this.import(
                        {
                            body: this.file,
                            contentType: this.file.type
                        }
                    );

                    if (id === null) {
                        return;
                    }

                    this.file = null;

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

<style lang="scss" scoped>
</style>

