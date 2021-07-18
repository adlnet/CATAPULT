/*
    Copyright 2020 Rustici Software

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/
import Vue from "vue";
import VueRouter from "vue-router";

import notFound from "@/components/notFound";
import courseList from "@/components/authenticated/course/list";
import courseDetail from "@/components/authenticated/course/detail";
import courseNew from "@/components/authenticated/course/new";
import courseNewUpload from "@/components/authenticated/course/new/upload";
import courseNewXmlEditor from "@/components/authenticated/course/new/xmlEditor";
import courseDetailStructure from "@/components/authenticated/course/detail/structure";
import courseDetailTestList from "@/components/authenticated/course/detail/testList";
import testNew from "@/components/authenticated/test/new";
import testDetail from "@/components/authenticated/test/detail";
import sessionDetail from "@/components/authenticated/session/detail";
import requirementsList from "@/components/authenticated/requirements/list";
import admin from "@/components/authenticated/admin";
import adminAbout from "@/components/authenticated/admin/about";
import adminUserList from "@/components/authenticated/admin/user/list";

Vue.use(VueRouter);

const idPropToNumber = ({params}) => ({id: Number.parseInt(params.id, 10)}),
    router = new VueRouter(
        {
            routes: [
                {
                    path: "/course-new",
                    component: courseNew,
                    children: [
                        {
                            path: "upload",
                            component: courseNewUpload
                        },
                        {
                            path: "xml-editor",
                            component: courseNewXmlEditor
                        }
                    ]
                },
                {
                    path: "/course/:id",
                    component: courseDetail,
                    props: idPropToNumber,
                    children: [
                        {
                            path: "structure",
                            component: courseDetailStructure,
                            props: idPropToNumber
                        },
                        {
                            path: "",
                            component: courseDetailTestList,
                            props: idPropToNumber
                        }
                    ]
                },
                {
                    path: "/test-new/:courseId",
                    component: testNew,
                    props: ({params}) => ({courseId: Number.parseInt(params.courseId, 10)})
                },
                {
                    path: "/test/:id",
                    component: testDetail,
                    props: idPropToNumber
                },
                {
                    path: "/session/:id",
                    component: sessionDetail,
                    props: idPropToNumber
                },
                {
                    path: "/requirements",
                    component: requirementsList
                },
                {
                    path: "/admin",
                    component: admin,
                    children: [
                        {
                            path: "user-list/:initPage?",
                            component: adminUserList,
                            props: true
                        },
                        {
                            path: "",
                            component: adminAbout
                        }
                    ]
                },
                {
                    path: "/:initPage?",
                    component: courseList,
                    props: true
                },
                {
                    path: "*",
                    component: notFound,
                    props: (route) => ({
                        path: route.params.pathMatch
                    })
                }
            ]
        }
    );

export default router;
