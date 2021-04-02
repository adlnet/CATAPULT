<template>
    <b-row>
        <b-col>
            <alerts kind="testDetail" />

            <template v-if="model.loading || ! model.item">
                Test details loading...
            </template>
            <template v-else-if="model.error">
                Error loading test: {{ model.errMsg }}
            </template>
            <template v-else>
                <b-row>
                    <b-col cols="7">
                        <template v-if="! courseModel || ! courseModel.loaded || courseModel.loading">
                            Course Details loading...
                        </template>
                        <template v-else-if="courseModel.error">
                            Failed to get course details: {{ courseModel.errMsg }}
                        </template>
                        <template v-else>
                            <h3>
                                Conformance Test for {{ courseModel.item.metadata.structure.course.title[0].text }}
                            </h3>
                            <p>
                                Course ID: {{ courseModel.item.metadata.structure.course.id }}
                            </p>
                        </template>

                        <p>
                            Registration: {{ model.item.metadata.actor.name }} ({{ model.item.code }})
                        </p>

                        <h4>Configuration</h4>
                        <b-card no-body>
                            <b-tabs card>
                                <b-tab title="Actor">
                                    Name: {{ model.item.metadata.actor.name }}
                                    <br>
                                    Account homepage: {{ model.item.metadata.actor.account.homePage }}
                                    <br>
                                    Account name: {{ model.item.metadata.actor.account.name }}
                                </b-tab>
                                <b-tab title="Agent Profile">
                                    <b-form>
                                        <b-form-group label="Language preference">
                                            <b-form-input v-model="languagePreference"></b-form-input>
                                        </b-form-group>
                                        <b-form-group label="Audio preference">
                                            <b-form-radio v-model="audioPreference" value="on">On</b-form-radio>
                                            <b-form-radio v-model="audioPreference" value="off">Off</b-form-radio>
                                        </b-form-group>
                                    </b-form>
                                </b-tab>
                                <b-tab title="Launch Settings">
                                    Launch Settings
                                </b-tab>
                            </b-tabs>
                        </b-card>

                        <h4 class="mt-3">Assignable Units</h4>
                        <b-card v-for="(au, index) in courseModel.item.metadata.aus" :key="index" class="mb-3">
                            <b-row>
                                <b-col>
                                    <h4>{{ au.title[0].text }}</h4>
                                </b-col>
                                <b-col cols="auto" class="text-right">
                                    <test-status status="pending" />
                                </b-col>
                            </b-row>
                            <b-row>
                                <b-col>
                                    <p>
                                        AU ID: {{ au.id }}
                                    </p>
                                </b-col>
                            </b-row>
                            <b-row>
                                <b-col>
                                    <b-button variant="primary" class="mr-3" @click="launchAU(index)">
                                        Launch
                                    </b-button>
                                    <b-button @click="waiveAU(index)">
                                        Waive
                                    </b-button>
                                </b-col>
                                <b-col class="text-right">
                                    <b-form-checkbox
                                        :id="`show-configuration-${index}`"
                                        switch
                                        @change="toggleConfig(index)"
                                    >
                                        Show Configuration
                                    </b-form-checkbox>
                                </b-col>
                            </b-row>
                            <b-row v-if="aUconfigs[index] && aUconfigs[index].show" class="mt-3">
                                <b-col>
                                    <b-row>
                                        <b-col>
                                            <h6>Configuration</h6>
                                        </b-col>
                                        <b-col cols="auto">
                                            <b-button variant="outline-primary" size="sm" @click="resetConfig(index)">Reset</b-button>
                                        </b-col>
                                    </b-row>
                                    <!-- TODO: preset these based on course structure configuration -->
                                    <b-form-group label="Launch method">
                                        <b-form-select v-model="aUconfigs[index].launchMethod">
                                            <b-form-select-option :value="null">From Course Structure</b-form-select-option>
                                            <b-form-select-option value="AnyWindow">Embedded Player</b-form-select-option>
                                            <b-form-select-option value="NewWindow">New Window</b-form-select-option>
                                        </b-form-select>
                                    </b-form-group>
                                    <b-form-group label="Launch parameters">
                                        <b-form-textarea v-model="aUconfigs[index].launchParameters"></b-form-textarea>
                                    </b-form-group>
                                    <b-form-group label="Mastery score">
                                        <b-form-input v-model="aUconfigs[index].masteryScore" type="number" min="0" max="1" step="0.1"></b-form-input>
                                    </b-form-group>
                                    <b-form-group label="Move on">
                                        <b-form-select v-model="aUconfigs[index].moveOn">
                                            <b-form-select-option :value="null">From Course Structure</b-form-select-option>
                                            <b-form-select-option value="NotApplicable">Not Applicable</b-form-select-option>
                                            <b-form-select-option value="Passed">Passed</b-form-select-option>
                                            <b-form-select-option value="Completed">Completed</b-form-select-option>
                                            <b-form-select-option value="CompletedAndPassed">CompletedAndPassed</b-form-select-option>
                                            <b-form-select-option value="CompletedOrPassed">CompletedOrPassed</b-form-select-option>
                                        </b-form-select>
                                    </b-form-group>
                                    <b-form-group label="Alternate entitlement key">
                                        <b-form-input v-model="aUconfigs[index].alternateEntitlementKey"></b-form-input>
                                    </b-form-group>
                                    <b-form-group label="Context template additions">
                                        <b-form-textarea v-model="aUconfigs[index].contextTemplateAdditions"></b-form-textarea>
                                    </b-form-group>
                                </b-col>
                            </b-row>
                        </b-card>
                    </b-col>
                    <b-col cols="5">
                        <b-card>
                            <template #header>
                                <b-row>
                                    <b-col>
                                        <h4 style="margin-bottom: 0px;">Test Report</h4>
                                    </b-col>
                                    <b-col cols="auto" class="text-right">
                                        <b-button variant="primary" disabled size="sm">Download</b-button>
                                    </b-col>
                                </b-row>
                            </template>
                        </b-card>
                    </b-col>
                </b-row>
            </template>
        </b-col>
    </b-row>
</template>

<script>
    import Vue from "vue";
    import Vuex from "vuex";
    import alerts from "@/components/alerts";
    import testStatus from "@/components/testStatus";

    const defaultAUConfig = {
        launchMethod: null,
        launchParameters: "",
        masteryScore: null,
        moveOn: null,
        alternateEntitlementKey: "",
        contextTemplateAdditions: ""
    };

    export default {
        name: "TestDetail",
        components: {
            alerts,
            testStatus
        },
        data: () => ({
            aUconfigs: {},
            audioPreference: null,
            languagePreference: null
        }),
        props: {
            id: {
                type: String,
                required: true
            }
        },
        computed: {
            model () {
                return this.$store.getters["service/tests/byId"]({id: this.id});
            },
            courseModel () {
                const result = this.$store.getters["service/courses/byId"]({id: this.model.item.courseId});

                if (! result.loaded) {
                    this.$store.dispatch("service/courses/loadById", {id: this.model.item.courseId});
                }

                return result;
            }
        },
        created () {
            this.$store.dispatch("service/tests/loadById", {id: this.id});
        },
        methods: {
            ...Vuex.mapActions(
                "service/sessions",
                [
                    "create"
                ]
            ),

            toggleConfig (index) {
                if (! this.aUconfigs[index]) {
                    Vue.set(
                        this.aUconfigs,
                        index,
                        {
                            show: false,
                            ...defaultAUConfig
                        }
                    );
                }

                this.aUconfigs[index].show = ! this.aUconfigs[index].show;
            },

            resetConfig (index) {
                for (const [k, v] of Object.entries(defaultAUConfig)) {
                    this.aUconfigs[index][k] = v;
                }
            },

            async launchAU (index) {
                try {
                    const id = await this.create(
                        {
                            testId: this.id,
                            auIndex: index
                        }
                    );

                    if (id === null) {
                        return;
                    }

                    this.$router.push(`/sessions/${id}`);
                }
                catch (ex) {
                    console.log(`Failed call to create session: ${ex}`);
                }
            },

            waiveAU (index) {
                console.log("test:detail:waiveAU", index);
            }
        }
    };
</script>

<style lang="scss" scoped>
</style>

