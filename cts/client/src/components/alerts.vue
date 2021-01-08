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
