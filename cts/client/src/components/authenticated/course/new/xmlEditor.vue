<template>
    <b-row class="flex-fill">
        <b-col cols="8" class="d-flex flex-column">
            <b-form-group
                id="courseNew-xmlEditor"
                label="Enter course structure XML string to validate and import."
                class="flex-fill d-flex flex-column"
            >
                <b-form-textarea id="courseStructureEntry" v-model="structure" class="flex-fill" no-resize>
                </b-form-textarea>
            </b-form-group>
            <div class="text-center mb-3">
                <b-button variant="primary" class="mr-1">
                    Validate
                </b-button>
                <b-button variant="primary" :disabled="structure === ''" @click="doImport">
                    Import
                </b-button>
            </div>
        </b-col>
        <b-col cols="4">
            Validation information can go here.
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
                            contentType: "application/xml"
                        }
                    );

                    if (id === null) {
                        return;
                    }

                    this.structure = "";

                    this.$router.push(`/courses/${id}`);
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
    #courseNew-xmlEditor {
        div {
            display: flex;
            flex: 1 1 auto;
            flex-direction: column;
        }
    }
</style>
