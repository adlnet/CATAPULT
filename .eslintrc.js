module.exports = {
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": 10,
        "ecmaFeatures": {
            "impliedStrict": true
        }
    },
    "rules": {
        "accessor-pairs": "error",
        "array-bracket-spacing": "error",
        "array-callback-return": "error",
        "arrow-body-style": ["error", "as-needed"],
        "arrow-parens": "error",
        "arrow-spacing": "error",
        "block-scoped-var": "error",
        "block-spacing": "error",
        "brace-style": [
            "error",
            "stroustrup"
        ],
        "callback-return": "off",
        "camelcase": "error",
        "capitalized-comments": "off",
        "class-methods-use-this": "error",
        "comma-dangle": "error",
        "comma-spacing": [
            "error",
            {
                "after": true,
                "before": false
            }
        ],
        "comma-style": [
            "error",
            "last"
        ],
        "complexity": "error",
        "computed-property-spacing": [
            "error",
            "never"
        ],
        "consistent-return": "off",
        "consistent-this": [
            "error",
            "self"
        ],
        "curly": "error",
        "default-case": "error",
        "dot-location": [
            "error",
            "property"
        ],
        "dot-notation": "error",
        "eol-last": "error",
        "eqeqeq": "error",
        "func-call-spacing": "error",
        "func-name-matching": "error",
        "func-names": [
            "error",
            "never"
        ],
        "func-style": "error",
        "generator-star-spacing": "error",
        "global-require": "error",
        "guard-for-in": "error",
        "handle-callback-err": "error",
        "id-blacklist": "error",
        "id-length": "off",
        "id-match": "error",
        "indent": [
            "error",
            4,
            {
                "SwitchCase": 1
            }
         ],
        "init-declarations": "off",
        "jsx-quotes": "error",
        "key-spacing": "error",
        "keyword-spacing": "error",
        "line-comment-position": "error",
        "linebreak-style": [
            // this is a warning because our build system checks out on Linux
            // then copies to Windows causing the line endings to be mismatched
            "warn",
            (require("os").EOL === "\r\n" ? "windows" : "unix")
        ],
        "lines-around-comment": "off",
        "lines-around-directive": "off",
        "max-depth": "error",
        "max-len": "off",
        "max-lines": "off",
        "max-nested-callbacks": "error",
        // This requires too much refactoring to do at the moment, so leaving
        // as a warning until we come back and focus on eslint unification
        "max-params": ["warn", 5],
        "max-statements": "off",
        "max-statements-per-line": "error",
        "multiline-ternary": "off",
        "new-cap": "error",
        "new-parens": "error",
        "newline-after-var": [
            "error",
            "always"
        ],
        "newline-before-return": "off",
        "newline-per-chained-call": "off",
        "no-alert": "error",
        "no-array-constructor": "error",
        "no-await-in-loop": "error",
        "no-bitwise": "error",
        "no-caller": "error",
        "no-catch-shadow": "error",
        "no-confusing-arrow": [
            "error",
            {
                "allowParens": true
            }
        ],
        "no-constant-condition": "error",
        "no-continue": "error",
        "no-div-regex": "error",
        "no-duplicate-imports": "error",
        "no-else-return": "error",
        "no-empty-function": "error",
        "no-eq-null": "error",
        "no-eval": "error",
        "no-extend-native": "error",
        "no-extra-bind": "error",
        "no-extra-label": "error",
        "no-extra-parens": [
            "error",
            "all",
            {"nestedBinaryExpressions": false}
        ],
        "no-floating-decimal": "error",
        "no-implicit-globals": "error",
        "no-implied-eval": "error",
        "no-inline-comments": "error",
        "no-invalid-this": "error",
        "no-iterator": "error",
        "no-label-var": "error",
        "no-labels": "error",
        "no-lone-blocks": "error",
        "no-lonely-if": "error",
        "no-loop-func": "error",
        "no-magic-numbers": [
            "error",
            {
                "ignore": [
                    // These are numbers that it's reasonable we would want to ignore
                    -1, 0, 1,
                    // These are HTTP statuses. Ideally we would make these constants, but that's a
                    // job for a more thorough eslint unification task.
                    200, 204, 302, 400, 401, 403, 404, 500
                ],
                "ignoreArrayIndexes": true
            }
        ],
        "no-mixed-operators": "error",
        "no-mixed-requires": "off",
        "no-multi-assign": "off",
        "no-multi-spaces": "error",
        "no-multi-str": "error",
        "no-multiple-empty-lines": [
            "error",
            {
                "max": 1,
                "maxBOF": 0,
                "maxEOF": 0
            }
        ],
        "no-native-reassign": "error",
        "no-negated-condition": "off",
        "no-negated-in-lhs": "error",
        "no-nested-ternary": "off",
        "no-new": "error",
        "no-new-func": "error",
        "no-new-object": "error",
        "no-new-require": "error",
        "no-new-wrappers": "error",
        "no-octal-escape": "error",
        "no-param-reassign": "error",
        "no-path-concat": "error",
        "no-plusplus": "error",
        "no-process-env": "error",
        "no-process-exit": "error",
        "no-proto": "error",
        "no-prototype-builtins": "off",
        "no-restricted-globals": "error",
        "no-restricted-imports": "error",
        "no-restricted-modules": "error",
        "no-restricted-properties": "error",
        "no-restricted-syntax": "error",
        "no-return-assign": "error",
        "no-return-await": "error",
        "no-script-url": "error",
        "no-self-compare": "error",
        "no-sequences": "error",
        "no-shadow": "off",
        "no-shadow-restricted-names": "error",
        "no-spaced-func": "error",
        "no-sync": "error",
        "no-tabs": "error",
        "no-template-curly-in-string": "error",
        "no-ternary": "off",
        "no-throw-literal": "error",
        "no-trailing-spaces": "error",
        "no-undef-init": "error",
        "no-undefined": "error",
        "no-underscore-dangle": "off",
        "no-unmodified-loop-condition": "error",
        "no-unneeded-ternary": "error",
        "no-unused-expressions": "error",
        "no-use-before-define": "error",
        "no-useless-call": "error",
        "no-useless-computed-key": "error",
        "no-useless-concat": "error",
        "no-useless-constructor": "error",
        "no-useless-escape": "error",
        "no-useless-rename": "error",
        "no-useless-return": "error",
        "no-var": "error",
        "no-void": "error",
        "no-warning-comments": "off",
        "no-whitespace-before-property": "error",
        "no-with": "error",
        "object-curly-newline": [
            "error",
            {
                "multiline": true,
                "consistent": true
            }
        ],
        "object-curly-spacing": "error",
        "object-property-newline": [
            "error",
            {
                "allowAllPropertiesOnSameLine": true
            }
        ],
        "object-shorthand": "off",
        "one-var": [
            "error",
            {
                "var": "always",
                "let": "consecutive",
                "const": "consecutive"
            }
        ],
        "one-var-declaration-per-line": "error",
        "operator-assignment": [
            "error",
            "always"
        ],
        "operator-linebreak": [
            "error",
            "before"
        ],
        "padded-blocks": [
            "error",
            "never"
        ],
        "padding-line-between-statements": [
            "error",
            {"blankLine": "always", "prev": "*", "next": "return"},
            {"blankLine": "always", "prev": ["const", "let", "var"], "next": "*"},
            {"blankLine": "any", "prev": ["const", "let", "var"], "next": ["const", "let", "var"]}
        ],
        "prefer-arrow-callback": "off",
        "prefer-const": "error",
        "prefer-numeric-literals": "error",
        "prefer-promise-reject-errors": "error",
        "prefer-reflect": "off",
        "prefer-rest-params": "off",
        "prefer-spread": "off",
        "prefer-template": "off",
        "quote-props": [
            "error",
            "as-needed"
        ],
        "quotes": [
            "error",
            "double"
        ],
        "radix": "error",
        "require-await": "error",
        "require-jsdoc": "off",
        "rest-spread-spacing": "error",
        "semi": "error",
        "semi-spacing": [
            "error",
            {
                "after": true,
                "before": false
            }
        ],
        "sort-imports": "off",
        "sort-keys": "off",
        "sort-vars": "off",
        "space-before-blocks": "error",
        "space-before-function-paren": "error",
        "space-in-parens": [
            "error",
            "never"
        ],
        "space-infix-ops": "error",
        "space-unary-ops": [
            2,
            {
                "words": true,
                "nonwords": false,
                "overrides": {
                    "!": true,
                    "!!": true
                }
            }
        ],
        "spaced-comment": [
            "error",
            "always"
        ],
        "strict": "error",
        "symbol-description": "error",
        "template-curly-spacing": "error",
        "template-tag-spacing": "error",
        "unicode-bom": [
            "error",
            "never"
        ],
        "valid-jsdoc": "off",
        "vars-on-top": "error",
        "wrap-iife": "error",
        "wrap-regex": "off",
        "yield-star-spacing": "error",
        "yoda": [
            "error",
            "never"
        ]
    }
};
