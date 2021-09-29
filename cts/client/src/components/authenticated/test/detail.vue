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
                                LMS ID: {{ courseModel.item.metadata.structure.course.lmsId }}
                                <br>
                                Publisher ID: {{ courseModel.item.metadata.structure.course.id }}
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
                                            <b-form-input v-model="model.item.learnerPrefs.languagePreference" :state="langPrefState" invalid-feedback="Value has to be a comma separated list of language codes"></b-form-input>
                                        </b-form-group>
                                        <b-form-group label="Audio preference">
                                            <b-form-radio name="audioPreference" v-model="model.item.learnerPrefs.audioPreference" value="on">On</b-form-radio>
                                            <b-form-radio name="audioPreference" v-model="model.item.learnerPrefs.audioPreference" value="off">Off</b-form-radio>
                                            <b-form-radio name="audioPreference" v-model="model.item.learnerPrefs.audioPreference" :value="null">None</b-form-radio>
                                        </b-form-group>
                                        <b-button variant="primary" size="sm" :disabled="model.item.learnerPrefs.languagePreference === '' || model.item.learnerPrefs.audioPreference === null" @click="doSaveLearnerPrefs" class="mr-2">Save</b-button>
                                        <b-button variant="primary" size="sm" :disabled="model.item.learnerPrefs._etag === null" @click="doClearLearnerPrefs" class="mr-2">Clear</b-button>
                                        <b-button size="sm" @click="loadLearnerPrefs({id})">Reload</b-button>
                                    </b-form>
                                </b-tab>
                            </b-tabs>
                        </b-card>

                        <h4 class="mt-3">Assignable Units</h4>
                        <template v-if="courseModel.item.metadata && courseModel.item.metadata.aus">
                            <b-card v-for="(au, index) in courseModel.item.metadata.aus" :key="index" class="mb-3">
                                <b-row>
                                    <b-col>
                                        <h4>{{ au.title[0].text }}</h4>
                                    </b-col>
                                    <b-col cols="auto" class="text-right">
                                        <test-status :status="model.item.metadata.aus[index].result" />
                                    </b-col>
                                </b-row>
                                <b-row v-if="au.parents && au.parents.length > 0" style="margin-bottom: 1em;">
                                    <b-col>
                                        <span class="block-path">({{ ["Root"].concat(au.parents.map((e) => e.title[0].text)).join(" &raquo; ") }})</span>
                                    </b-col>
                                </b-row>
                                <b-row>
                                    <b-col>
                                        <b-dropdown
                                            split
                                            text="Launch"
                                            variant="primary"
                                            class="mr-3"
                                            @click="doLaunchAU(index)"
                                            :disabled="!isConfigValid(index)"
                                            :title="(aUconfigs && aUconfigs[index] && aUconfigs[index].launchErrorMessage) ? aUconfigs[index].launchErrorMessage : ''">
                                            <b-dropdown-item-button @click="doLaunchAU(index, 'Normal')">Force Normal</b-dropdown-item-button>
                                            <b-dropdown-item-button @click="doLaunchAU(index, 'Browse')">Force Browse</b-dropdown-item-button>
                                            <b-dropdown-item-button @click="doLaunchAU(index, 'Review')">Force Review</b-dropdown-item-button>
                                        </b-dropdown>
                                        <b-dropdown lazy text="Waive AU">
                                            <b-dropdown-header>Reason</b-dropdown-header>
                                            <b-dropdown-item-button @click="doWaiveAU(index, 'Tested Out')">Tested Out</b-dropdown-item-button>
                                            <b-dropdown-item-button @click="doWaiveAU(index, 'Equivalent AU')">Equivalent AU</b-dropdown-item-button>
                                            <b-dropdown-item-button @click="doWaiveAU(index, 'Equivalent Outside Activity')">Equivalent Outside Activity</b-dropdown-item-button>
                                            <b-dropdown-item-button @click="doWaiveAU(index, 'Administrative')">Administrative</b-dropdown-item-button>
                                        </b-dropdown>
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
                                        <b-form-group :label="`Launch method (${au.launchMethod})`">
                                            <b-form-select v-if="au.launchMethod === 'AnyWindow'" v-model="aUconfigs[index].launchMethod">
                                                <b-form-select-option :value="null">Default</b-form-select-option>
                                                <b-form-select-option value="iframe">This Window</b-form-select-option>
                                                <b-form-select-option value="newWindow">New Window</b-form-select-option>
                                            </b-form-select>
                                            <b-form-select disabled v-else v-model="aUconfigs[index].launchMethod">
                                                <b-form-select-option selected :value="null">New Window</b-form-select-option>
                                            </b-form-select>
                                        </b-form-group>
                                        <b-form-group label="Launch parameters">
                                            <b-form-textarea v-model="aUconfigs[index].launchParameters"></b-form-textarea>
                                        </b-form-group>
                                        <b-form-group label="Mastery score" :invalid-feedback="aUconfigs[index].masteryScoreErr">
                                            <b-form-input
                                                v-model="aUconfigs[index].masteryScore"
                                                number
                                                type="number"
                                                min="0"
                                                max="1"
                                                step="0.1"
                                                :state="isMasteryScoreValid(index)">
                                            </b-form-input>
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
                                        <b-form-group label="Context template additions" :invalid-feedback="aUconfigs[index].contextTemplateAdditionsErr">
                                            <b-form-textarea :state="aUconfigs[index].contextTemplateAdditionsState" v-model="aUconfigs[index].contextTemplateAdditionsText" @blur="contextTemplateAdditionsBlur(index)"></b-form-textarea>
                                        </b-form-group>
                                    </b-col>
                                </b-row>
                            </b-card>
                        </template>
                        <p v-else-if="courseModel.item.loading">
                            Loading course metadata...
                        </p>
                        <p v-else>
                            List of AUs unavailable.
                        </p>
                    </b-col>
                    <b-col cols="5">
                        <b-card>
                            <template #header>
                                <b-row>
                                    <b-col>
                                        <h4 style="margin-bottom: 0">Test Report</h4>
                                    </b-col>
                                    <b-col cols="auto" class="text-right">
                                        <b-button size="sm" variant="primary" @click="download">Download</b-button>
                                    </b-col>
                                </b-row>
                            </template>
                            <h5>Conformance Status</h5>
                            <ul v-if="courseModel.loaded" style="list-style: none; padding-left: 0">
                                <structure-node key="course" :item="courseModel.item.metadata.structure.course" :courseResult="model.item.metadata.result" :auList="model.item.metadata.aus"></structure-node>
                            </ul>
                            <h5>Registration Log</h5>
                            <ul v-if="logCache.items.length > 0">
                                <li v-for="(log) in logCache.items" :key="log.id" class="registration-log">
                                    <template v-if="log.metadata.resource === 'sessions:create'">
                                        <b-link :to="`/session/${log.metadata.sessionId}`">
                                            AU Launched: {{ courseModel.item.metadata.aus[log.metadata.auIndex].title[0].text }}
                                        </b-link>
                                    </template>
                                    <template v-else-if="log.metadata.resource === 'registration:waive-au'">
                                        AU Waived: {{ courseModel.item.metadata.aus[log.metadata.auIndex].title[0].text }} ({{ log.metadata.reason }})
                                    </template>
                                    <template v-else>
                                        {{ log.metadata.summary }}
                                    </template>
                                </li>
                            </ul>
                            <p v-else-if="logCache.loading">
                                Loading...
                            </p>
                            <p v-else-if="logCache.err">
                                Error: {{ logCache.errMsg }}
                            </p>
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
    import structureNode from "./detail/structure/node";

    const defaultAUConfig = {
        launchMethod: undefined,
        launchParameters: undefined,
        masteryScore: undefined,
        moveOn: undefined,
        alternateEntitlementKey: undefined,
        contextTemplateAdditions: undefined,
        contextTemplateAdditionsText: "",
        contextTemplateAdditionsState: null
    };

    export default {
        name: "TestDetail",
        components: {
            alerts,
            testStatus,
            structureNode
        },
        data: () => ({
            aUconfigs: {}
        }),
        props: {
            id: {
                type: Number,
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
            },
            logCache () {
                const cacheKey = this.$store.getters["service/tests/logs/cacheKey"]({id: this.id})

                return this.$store.getters["service/tests/logs/cache"]({cacheKey});
            },
            langPrefState () {
                const value = this.model.item.learnerPrefs.languagePreference;

                if (value === null || value === "") {
                    return null;
                }

                if (/^[-A-Za-z0-9]+(?:,[-A-Za-z0-9]+)*$/.test(value)) {
                    return true;
                }

                return false;
            }
        },
        mounted () {
            this.loadLogs({props: {id: this.id}, force: true});
            this.loadLearnerPrefs({id: this.id});
        },
        created () {
            this.$store.dispatch("service/tests/loadById", {id: this.id});
        },
        methods: {
            ...Vuex.mapActions(
                "service/tests",
                [
                    "waiveAU",
                    "loadLearnerPrefs",
                    "saveLearnerPrefs",
                    "clearLearnerPrefs",
                    "triggerDownload"
                ]
            ),
            ...Vuex.mapActions(
                "service/tests/logs",
                {
                    loadLogs: "load"
                }
            ),
            ...Vuex.mapActions(
                "service/sessions",
                {
                    createSession: "create"
                }
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

            async download () {
                try {
                    await this.triggerDownload({id: this.id});
                }
                catch (ex) {
                    this.$store.dispatch("service/tests/alert", {content: `Failed to trigger download: ${ex}`, kind: "testDetail"});
                }
            },

            async doSaveLearnerPrefs () {
                try {
                    await this.saveLearnerPrefs({id: this.id});
                }
                catch (ex) {
                    console.log(`Failed call to save learner preferences: ${ex}`);
                }
            },

            async doClearLearnerPrefs () {
                try {
                    await this.clearLearnerPrefs({id: this.id});
                }
                catch (ex) {
                    console.log(`Failed call to clear learner preferences: ${ex}`);
                }
            },

            async doLaunchAU (index, launchMode) {
                try {
                    const id = await this.createSession(
                        {
                            testId: this.id,
                            auIndex: index,
                            launchCfg: this.aUconfigs[index] || defaultAUConfig,
                            launchMode
                        }
                    );

                    if (id === null) {
                        return;
                    }

                    this.$router.push(`/session/${id}`);
                }
                catch (ex) {
                    console.log(`Failed call to create session: ${ex}`);
                }
            },

            async doWaiveAU (auIndex, reason) {
                try {
                    await this.waiveAU(
                        {
                            id: this.id,
                            auIndex,
                            reason
                        }
                    );

                    this.loadLogs({props: {id: this.id}, force: true});
                }
                catch (ex) {
                    console.log(`Failed call to waive AU (${auIndex}): ${ex}`);
                }
            },

            contextTemplateAdditionsBlur (index) {
                this.aUconfigs[index].contextTemplateAdditionsState = null;

                if (this.aUconfigs[index].contextTemplateAdditionsText) {
                    try {
                        const decode = JSON.parse(this.aUconfigs[index].contextTemplateAdditionsText)
                        if (!!decode && decode.constructor === Object) {
                            this.aUconfigs[index].contextTemplateAdditions = decode;
                        }
                        else {
                            this.aUconfigs[index].contextTemplateAdditionsState = false;
                            this.aUconfigs[index].contextTemplateAdditionsErr = `JSON must be an object.`;

                            return;
                        }
                    }
                    catch (ex) {
                        this.aUconfigs[index].contextTemplateAdditionsState = false;
                        this.aUconfigs[index].contextTemplateAdditionsErr = `Invalid JSON: ${ex}`;

                        return;
                    }

                    this.aUconfigs[index].contextTemplateAdditionsState = true;
                }
            },

            isConfigValid (index) {
                if (!this.aUconfigs || !this.aUconfigs[index]) {
                    return true;
                }
                this.aUconfigs[index].launchErrorMessage = "";
                if (this.isMasteryScoreValid(index) === false) {
                    this.aUconfigs[index].launchErrorMessage = "Mastery score failed to validate: " + this.aUconfigs[index].masteryScoreErr;
                    return false;
                }
                if (this.aUconfigs[index].contextTemplateAdditionsState === false) {
                    this.aUconfigs[index].launchErrorMessage = "Context template additions failed to validate: " + this.aUconfigs[index].contextTemplateAdditionsErr;
                    return false;
                }
                return true;
            },

            isMasteryScoreValid (index) {
                this.aUconfigs[index].masteryScoreErr = "";
                if (!this.aUconfigs ||
                    !this.aUconfigs[index] ||
                    typeof this.aUconfigs[index].masteryScore === "undefined" ||
                    this.aUconfigs[index].masteryScore === "") {
                    return null;
                }
                if (this.aUconfigs[index].masteryScore < 0 || this.aUconfigs[index].masteryScore > 1) {
                    this.aUconfigs[index].masteryScoreErr = "Mastery score must be a decimal value between 0 and 1 (inclusive)";
                    return false;
                }
                return true;
            }
        }
    };
</script>

<style lang="scss" scoped>
    .block-path {
        font-weight: bold;
        font-size: smaller;
    }
    .registration-log {
        li {
            margin-bottom: 0;
        }
    }
</style>
