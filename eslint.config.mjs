import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";

export default defineConfig([
    ...nextVitals,
    ...nextTs,
    prettier,
    globalIgnores([
        ".next/**",
        "out/**",
        "dist/**",
        "build/**",
        "coverage/**",
        "node_modules/**",
        "packages/**/dist/**",
        "public/uploads/**",
        "**/*.tsbuildinfo",
        "next-env.d.ts",
        "vitest.config.*",
        "playwright.config.ts",
    ]),
    {
        plugins: {
            import: importPlugin,
        },
        settings: {
            react: {
                version: "detect",
            },
            "import/resolver": {
                typescript: {
                    alwaysTryTypes: true,
                },
            },
        },
        rules: {
            "no-case-declarations": "error",
            "prefer-const": "error",
            "no-var": "error",
            "no-console": [
                "warn",
                {
                    allow: ["error", "warn"],
                },
            ],
            "no-unused-vars": "off",
            "no-undef": "off",
            "no-redeclare": "error",
            "no-unreachable": "error",
            "no-duplicate-imports": "error",
            "no-useless-return": "error",
            "no-useless-concat": "error",
            "prefer-template": "error",
            "prefer-arrow-callback": "warn",
            "prefer-spread": "warn",
            "react/prop-types": "off",
            "react/react-in-jsx-scope": "off",
            "react/jsx-uses-react": "off",
            "react/jsx-uses-vars": "error",
            "react/jsx-key": "error",
            "react/jsx-no-duplicate-props": "error",
            "react/jsx-no-undef": "error",
            "react/jsx-no-useless-fragment": "warn",
            "react/self-closing-comp": "warn",
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/explicit-function-return-type": "off",
            "@typescript-eslint/explicit-module-boundary-types": "off",
            "@typescript-eslint/no-inferrable-types": "off",
            "@typescript-eslint/no-non-null-assertion": "warn",
            "import/order": [
                "warn",
                {
                    groups: [
                        "builtin",
                        "external",
                        "internal",
                        "parent",
                        "sibling",
                        "index",
                    ],
                    "newlines-between": "always",
                    alphabetize: {
                        order: "asc",
                        caseInsensitive: true,
                    },
                },
            ],
            "import/no-duplicates": "error",
            "import/no-unresolved": "off",
            "jsx-a11y/alt-text": "warn",
            "jsx-a11y/anchor-is-valid": "warn",
            "jsx-a11y/click-events-have-key-events": "warn",
            "jsx-a11y/no-noninteractive-element-interactions": "warn",
        },
    },
    {
        files: ["scripts/**/*.js"],
        rules: {
            "@typescript-eslint/no-require-imports": "off",
            "no-console": "off",
        },
    },
    {
        files: [
            "next.config.js",
            "playwright.config.*",
            "vitest.config.*",
            "postcss.config.js",
            "eslint.config.mjs",
            "nest-api-rewrite.cjs",
        ],
        rules: {
            "@typescript-eslint/no-var-requires": "off",
            "@typescript-eslint/no-require-imports": "off",
            "no-console": "off",
        },
    },
]);
