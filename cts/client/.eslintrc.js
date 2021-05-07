module.exports = {
    env: {
        browser: true,
        node: true
    },
    "extends": [
        "plugin:vue/essential",
        "eslint:recommended"
    ],
    parserOptions: {
        parser: "babel-eslint"
    },
    rules: {
        "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
        "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",

        "vue/max-attributes-per-line": [
            "error",
            {
                // this is arbitrary, the key is to allow multiple on a single line
                // but force multiline attributes to all be on a single line
                singleline: 6,
                multiline: {
                    max: 1,
                    allowFirstLine: false
                }
            }
        ],
        "vue/html-self-closing": "off"
    },
    overrides: [
        {
            files: ["*.vue"],
            rules: {
                indent: "off",
                "vue/html-indent": [
                    "error",
                    4,
                    {
                        baseIndent: 1
                    }
                ],
                "vue/script-indent": [
                    "error",
                    4,
                    {
                        baseIndent: 1
                    }
                ],
                "vue/name-property-casing": "off"
            }
        }
    ]
};
