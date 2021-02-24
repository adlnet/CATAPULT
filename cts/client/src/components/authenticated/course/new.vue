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
