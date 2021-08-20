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
            <template v-if="courseModel.loading || ! courseModel.item">
                Course details loading...
            </template>
            <template v-else-if="courseModel.error">
                Error loading course: {{ courseModel.errMsg }}
            </template>
            <template v-else>
                <alerts kind="testNew" />

                <h3>
                    Conformance Test for {{ courseModel.item.metadata.structure.course.title[0].text }}
                </h3>
                <p>
                    LMS ID: {{ courseModel.item.metadata.structure.course.lmsId }}
                    <br>
                    Publisher ID: {{ courseModel.item.metadata.structure.course.id }}
                </p>
                <b-form>
                    <b-row>
                        <b-col>
                            <h4>Actor</h4>
                        </b-col>
                        <b-col class="text-right">
                            <b-button variant="outline-primary" size="sm" @click="randomizeActor">
                                <b-icon-arrow-repeat></b-icon-arrow-repeat> Randomize
                            </b-button>
                        </b-col>
                    </b-row>
                    <b-form-group label="Name">
                        <b-form-input type="text" v-model="actor.name">
                        </b-form-input>
                    </b-form-group>
                    <b-form-group label="Account homepage">
                        <b-form-input type="text" v-model="actor.account.homePage">
                        </b-form-input>
                    </b-form-group>
                    <b-form-group label="Account name">
                        <b-form-input type="text" v-model="actor.account.name">
                        </b-form-input>
                    </b-form-group>
                    <b-button variant="primary" :disabled="actor.account.name === '' || actor.account.homePage === ''" @click="doCreateTest">
                        Continue
                    </b-button>
                </b-form>
            </template>
        </b-col>
    </b-row>
</template>

<script>
    import Vuex from "vuex";
    import faker from "faker/locale/en";
    import alerts from "@/components/alerts";
    import {BIconArrowRepeat} from "bootstrap-vue";

    export default {
        name: "TestNew",
        components: {
            alerts,
            BIconArrowRepeat
        },
        props: {
            courseId: {
                type: Number,
                required: true
            }
        },
        data: () => ({
            actor: {
                name: "",
                account: {
                    name: "",
                    homePage: ""
                }
            }
        }),
        computed: {
            courseModel () {
                return this.$store.getters["service/courses/byId"]({id: this.courseId});
            }
        },
        created () {
            this.$store.dispatch("service/courses/loadById", {id: this.courseId});
        },
        methods: {
            ...Vuex.mapActions(
                "service/tests",
                [
                    "create"
                ]
            ),

            randomizeActor () {
                this.actor.name = faker.name.findName();
                this.actor.account.homePage = `urn:catapult-cts:${faker.git.shortSha()}`;
                this.actor.account.name = faker.git.shortSha();
            },

            async doCreateTest () {
                try {
                    const id = await this.create(
                        {
                            courseId: this.courseId,
                            actor: {
                                objectType: "Agent",
                                ...this.actor
                            }
                        }
                    );

                    if (id === null) {
                        return;
                    }

                    this.$router.push(`/test/${id}`);
                }
                catch (ex) {
                    console.log(`Failed call to create test: ${ex}`);
                }
            }
        }
    };
</script>

<style lang="scss" scoped>
</style>

