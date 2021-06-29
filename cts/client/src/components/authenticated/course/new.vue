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
            <h2 class="mb-3">New Course</h2>

            <alerts kind="courseNew" />

            <b-nav tabs class="my-3">
                <b-nav-item to="/course-new/upload" active-class="active">
                    File Upload
                </b-nav-item>
                <b-nav-item to="/course-new/xml-editor" active-class="active">
                    XML Editor
                </b-nav-item>
            </b-nav>
            <router-view></router-view>
        </b-col>
    </b-row>
</template>

<script>
    import alerts from "@/components/alerts";

    export default {
        name: "CourseNew",
        components: {
            alerts
        },
        data: () => ({
        })
    };
</script>

<style lang="scss" scoped>
</style>
