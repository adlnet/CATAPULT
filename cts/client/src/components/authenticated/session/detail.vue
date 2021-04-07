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
                            <b-button variant="primary" @click="closeAU" class="mr-3">Close</b-button>
                            <b-button @click="abandonSession">Abandon</b-button>
                        </b-col>
                    </b-row>
                </template>
                <b-row class="flex-fill">
                    <b-col cols="8" class="d-flex flex-column">
                        <iframe :src="model.item.launchUrl" class="flex-fill"></iframe>
                    </b-col>
                    <b-col cols="4" class="d-flex flex-column">
                        <h5>Event Log</h5>
                        <ul>
                            <li v-for="(event, index) in events" :key="index">
                                {{ event }}
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
    import alerts from "@/components/alerts";

    let eventSource;

    export default {
        name: "SessionDetail",
        components: {
            alerts
        },
        props: {
            id: {
                type: String,
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
        created () {
            const self = this;

            this.$store.dispatch("service/sessions/loadById", {id: this.id});

            eventSource = this.$store.getters["service/eventSource"](`sessions/${this.id}/events`);

            eventSource.addEventListener(
                "control",
                (event) => {
                    const data = JSON.parse(event.data);

                    self.events.unshift(`control: ${JSON.stringify(data)}`);
                }
            );

            eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);

                self.events.unshift(JSON.stringify(data));
            };
            eventSource.onopen = () => {
                self.listening = true;
            };
            eventSource.onclose = () => {
                self.listening = false;
            };
        },
        methods: {
            closeAU () {
                eventSource.close();

                this.$router.push(`/tests/${this.model.item.registrationId}`);
            },
            abandonSession () {
            }
        }
    };
</script>

<style lang="scss" scoped>
</style>
