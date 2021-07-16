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
        <b-row align-v="center" class="mb-3">
            <b-col>
                <h4 class="mx-0 align-middle">
                    cmi5 Specification Requirements
                </h4>
            </b-col>
        </b-row>
        <b-table
            :fields="fields"
            :items="filtered"
            primary-key="id"
            show-empty
            empty-text="No requirements found."
            small
            striped
            class="requirements"
        >
            <template #head(id)>
                Identifier
                <b-form-input :state="configurationFilters.id.state" trim size="sm" placeholder="Filter on identifier" @update="idFilterUpdate"></b-form-input>
                <b-form-invalid-feedback>
                    {{ configurationFilters.id.feedback }}
                </b-form-invalid-feedback>
            </template>
            <template #head(txt)>
                Text
                <b-form-input :state="configurationFilters.txt.state" trim size="sm" placeholder="Filter on text" @update="txtFilterUpdate"></b-form-input>
                <b-form-invalid-feedback>
                    {{ configurationFilters.txt.feedback }}
                </b-form-invalid-feedback>
            </template>
            <template #cell(id)="row">
                {{ row.value }}
            </template>
            <template #cell(txt)="row">
                {{ row.value }}
            </template>
        </b-table>
    </div>
</template>

<script>
    import requirements from "@cmi5/requirements";

    export default {
        name: "requirementsList",
        data: () => ({
            items: Object.entries(requirements).map(
                ([k, v]) => ({
                    id: k,
                    txt: v.txt
                })
            ),
            fields: [
                {
                    label: "Identifier",
                    key: "id",
                    sortable: true
                },
                {
                    label: "Text",
                    key: "txt"
                }
            ],
            configurationFilters: {
                id: {
                    re: null,
                    state: null,
                    feedback: ""
                },
                txt: {
                    re: null,
                    state: null,
                    feedback: ""
                }
            }
        }),
        computed: {
            unfiltered () {
                return this.items;
            },
            filtered () {
                let result = this.unfiltered;

                const idFilter = this.configurationFilters.id,
                    txtFilter = this.configurationFilters.txt; // eslint-disable-line vue/script-indent

                if (idFilter.re) {
                    result = result.filter(
                        (e) => idFilter.re.test(e.id)
                    );
                }
                if (txtFilter.re) {
                    result = result.filter(
                        (e) => txtFilter.re.test(e.txt)
                    );
                }

                return result;
            }
        },
        methods: {
            inputFilterUpdate (kind, value) {
                const filter = this.configurationFilters[kind];

                if (value === "") {
                    filter.re = null;
                    filter.feedback = "";
                    filter.state = null;

                    return;
                }

                try {
                    filter.re = new RegExp(value, "i");
                    filter.state = true;
                }
                catch (ex) {
                    filter.re = null;
                    filter.state = false;
                    filter.feedback = `Invalid filter ${value}: ${ex}`;
                }
            },

            idFilterUpdate (v) {
                this.inputFilterUpdate("id", v);
            },

            txtFilterUpdate (v) {
                this.inputFilterUpdate("txt", v);
            }
        }
    };
</script>

<style lang="scss">
    table.requirements {
        thead tr th {
            border: 0px;
            vertical-align: top;
        }

        td.txt {
            word-break: break-all;
        }
    }
</style>
