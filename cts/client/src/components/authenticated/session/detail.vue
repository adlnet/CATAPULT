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
            <alerts kind="sessionDetail" />

            <b-card class="flex-fill mb-3" body-class="d-flex flex-column">
                <template #header>
                    <b-row>
                        <b-col>
                            <h5 style="margin-bottom: 0px;">
                                <template v-if="! courseModel || ! courseModel.loaded || courseModel.loading">
                                    Course Details loading...
                                </template>
                                <template v-else-if="courseModel.error">
                                    Failed to get course details: {{ courseModel.errMsg }}
                                </template>
                                <template v-else>
                                    <h3>
                                        {{ courseModel.item.metadata.structure.course.title[0].text }}
                                    </h3>
                                </template>
                            </h5>
                        </b-col>
                        <b-col cols="auto" class="text-right">
                            <b-button variant="primary" @click="doCloseAU" class="mr-3">Close</b-button>
                            <b-button @click="doAbandon">Abandon</b-button>
                        </b-col>
                    </b-row>
                </template>
                <b-row class="flex-fill">
                    <b-col cols="8" class="d-flex flex-column fit-window-column">
                        <template v-if="launchUrl">
                            <iframe v-if="model.item.launchMethod === 'iframe'" :src="launchUrl" class="flex-fill"></iframe>
                            <template v-else-if="model.item.launchMethod === 'newWindow'">
                                <p v-if="openWindowFailure">
                                    AU launch URL was not able to open in a new window. Is there a popup blocker preventing the launch?
                                    <br>
                                    <b-button :href="launchUrl" target="_default">Try Again</b-button>
                                </p>
                                <p v-else>
                                    AU has been launched in a new window.
                                </p>
                            </template>
                            <p v-else>
                                Unrecognized launch method: {{ model.item.launchMethod }}
                            </p>
                        </template>
                        <p v-else>
                            Session appears to be closed, providing session details but no launch.
                        </p>
                    </b-col>
                    <b-col cols="4" class="d-flex flex-column fit-window-column event-log">
                        <h5>Event Log</h5>
                        <ul>
                            <li v-for="(event, index) in logs.items" :key="index">
                                <template v-if="event.metadata.violatedReqId">
                                    Spec requirement violated: <span :id="`violated-req-id-${index}`">{{ event.metadata.violatedReqId }}</span>

                                    <b-popover :target="`violated-req-id-${index}`" :title="event.metadata.violatedReqId" triggers="hover" placement="bottomleft">
                                        {{ requirements[event.metadata.violatedReqId].txt || `Unrecognized requirement id: ${event.metadata.violatedReqId}` }}
                                    </b-popover>
                                </template>
                                <template v-else>
                                    {{ event.metadata.summary }}
                                </template>
                            </li>
                        </ul>
                    </b-col>
                </b-row>
            </b-card>
            <template v-if="model.loading || ! model.item">
                Session detail loading...
            </template>
            <template v-else-if="model.error">
                Error loading session: {{ model.errMsg }}
            </template>
        </b-col>
    </b-row>
</template>

<script>
    import Vuex from "vuex";
    import alerts from "@/components/alerts";
    import requirements from "@cmi5/requirements";

    export default {
        name: "SessionDetail",
        components: {
            alerts
        },
        props: {
            id: {
                type: Number,
                required: true
            }
        },
        data: () => ({
            launchUrl: null,
            openWindowFailure: false,
            requirements
        }),
        computed: {
            model () {
                return this.$store.getters["service/sessions/byId"]({id: this.id});
            },
            testModel () {
                let result;

                if (this.model.item.registrationId) {
                    result = this.$store.getters["service/tests/byId"]({id: this.model.item.registrationId});

                    if (! result.loaded) {
                        this.$store.dispatch("service/tests/loadById", {id: this.model.item.registrationId});
                    }
                }

                return result;
            },
            courseModel () {
                let result;

                if (this.testModel && this.testModel.item.courseId) {
                    result = this.$store.getters["service/courses/byId"]({id: this.testModel.item.courseId});

                    if (! result.loaded) {
                        this.$store.dispatch("service/courses/loadById", {id: this.testModel.item.courseId});
                    }
                }

                return result;
            },
            listening () {
                return this.logs.listener !== null;
            },
            logs () {
                const cacheKey = this.$store.getters["service/sessions/logs/cacheKey"]({id: this.id});

                return this.$store.getters["service/sessions/logs/cache"]({cacheKey});
            }
        },
        async created () {
            await this.$store.dispatch("service/sessions/loadById", {id: this.id});

            if (this.model.item.launchUrl) {
                this.launchUrl = this.model.item.launchUrl;
                delete this.model.item.launchUrl;

                if (this.model.item.launchMethod === "newWindow") {
                    const result = window.open(this.launchUrl);

                    if (result === null) {
                        this.openWindowFailure = true;
                    }
                }

                this.startLogListener({id: this.id});
            }
            else {
                this.loadLogs({props: {id: this.id}});
            }
        },
        methods: {
            ...Vuex.mapActions(
                "service/sessions",
                [
                    "abandon"
                ]
            ),
            ...Vuex.mapActions(
                "service/sessions/logs",
                {
                    loadLogs: "load",
                    startLogListener: "startListener",
                    stopLogListener: "stopListener"
                }
            ),
            doCloseAU () {
                this.$store.dispatch("service/tests/loadById", {id: this.model.item.registrationId, force: true});

                this.stopLogListener({id: this.id});
                this.$router.push(`/test/${this.model.item.registrationId}`);
            },
            async doAbandon () {
                try {
                    await this.abandon(
                        {
                            id: this.id
                        }
                    );
                }
                catch (ex) {
                    console.log(`Failed call to abandon (${this.id}): ${ex}`);
                }
            }
        }
    };
</script>

<style lang="scss" scoped>
.fit-window-column {
    height: calc(100vh - 220px);
}
.event-log {
    overflow-y: scroll;
}
</style>
