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
                    "upload"
                ]
            ),

            async doUpload () {
                try {
                    const id = await this.upload({file: this.file});

                    if (id === null) {
                        return;
                    }

                    this.file = null;

                    // TODO: trigger route to course detail page
                    this.$router.push(`/courses/${id}`);
                }
                catch (ex) {
                    // failing the upload should have already posted an alert
                    console.log(`Failed call to upload: ${ex}`);
                }
            }
        }
    };
</script>

<style lang="scss" scoped>
</style>

