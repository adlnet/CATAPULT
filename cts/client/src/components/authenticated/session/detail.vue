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
                    <b-col cols="8" class="d-flex flex-column">
                        <template v-if="model.item.launchUrl">
                            <iframe v-if="model.item.launchMethod === 'iframe'" :src="model.item.launchUrl" class="flex-fill"></iframe>
                            <p v-else-if="model.item.launchMethod === 'newWindow'">
                                AU has been launched in a new window.
                            </p>
                            <p v-else>
                                Unrecognized launch method: {{ model.item.launchMethod }}
                            </p>
                        </template>
                        <p v-else>
                            Session appears to be closed, providing session details but no launch.
                        </p>
                    </b-col>
                    <b-col cols="4" class="d-flex flex-column">
                        <h5>Event Log</h5>
                        <ul>
                            <li v-for="(event, index) in events" :key="index">
                                {{ event.summary }}
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
    /* globals TextDecoderStream, TransformStream */
    import Vuex from "vuex";
    import alerts from "@/components/alerts";

    let stream;

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
            listening: false,
            events: []
        }),
        computed: {
            model () {
                return this.$store.getters["service/sessions/byId"]({id: this.id});
            },
            testModel () {
                const result = this.$store.getters["service/tests/byId"]({id: this.model.item.registrationId});

                if (! result.loaded) {
                    this.$store.dispatch("service/tests/loadById", {id: this.model.item.registrationId});
                }

                return result;
            },
            courseModel () {
                const result = this.$store.getters["service/courses/byId"]({id: this.testModel.item.courseId});

                if (! result.loaded) {
                    this.$store.dispatch("service/courses/loadById", {id: this.testModel.item.courseId});
                }

                return result;
            }
        },
        async created () {
            await this.$store.dispatch("service/sessions/loadById", {id: this.id});

            if (this.model.item.launchUrl && this.model.item.launchMethod === "newWindow") {
                window.open(this.model.item.launchUrl);
            }

            const response = await this.$store.getters["service/makeApiRequest"](`sessions/${this.id}/events`);

            stream = response.body.pipeThrough(new TextDecoderStream()).pipeThrough(
                //
                // this stream takes the text stream as input, splits the text on \n
                // and then JSON parses the lines, providing each chunk of JSON to
                // the next handler in the chain
                //
                new TransformStream(
                    {
                        start (controller) {
                            controller.buf = "";
                            controller.pos = 0;
                        },
                        transform (chunk, controller) {
                            controller.buf += chunk;

                            while (controller.pos < controller.buf.length) {
                                if (controller.buf[controller.pos] === "\n") {
                                    const line = controller.buf.substring(0, controller.pos);

                                    controller.enqueue(JSON.parse(line));

                                    controller.buf = controller.buf.substring(controller.pos + 1);
                                    controller.pos = 0;
                                }
                                else {
                                    ++controller.pos;
                                }
                            }
                        }
                    }
                )
            );

            const reader = stream.getReader();

            this.listening = true;

            while (true) { // eslint-disable-line no-constant-condition
                try {
                    const {done, value} = await reader.read();

                    this.events.unshift(value);

                    if (done) {
                        this.listening = false;
                        break;
                    }
                }
                catch (ex) {
                    this.listening = false;
                    break;
                }
            }
        },
        methods: {
            ...Vuex.mapActions(
                "service/sessions",
                [
                    "abandon"
                ]
            ),
            doCloseAU () {
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
</style>
