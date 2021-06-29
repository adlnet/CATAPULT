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
    <div>
        <b-alert v-for="alert in alerts" :key="alert.id" :variant="alert.variant" dismissible show @dismissed="dismissAlert(alert.id)">
            {{ alert.content }}
        </b-alert>
    </div>
</template>

<script>
    export default {
        name: "alerts",
        props: {
            kind: {
                type: String,
                required: true
            }
        },
        computed: {
            alerts () {
                return this.$store.getters["alerts/list"](this.kind);
            }
        },
        methods: {
            dismissAlert (id) {
                this.$store.commit(
                    "alerts/remove",
                    {
                        kind: this.kind,
                        id
                    }
                );
            }
        }
    };
</script>

<style lang="scss" scoped>
</style>
