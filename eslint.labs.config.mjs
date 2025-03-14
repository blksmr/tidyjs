import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import eslintPluginImport from "eslint-plugin-import";
import js from "@eslint/js";

export default [
    js.configs.recommended,
    
    {
        files: ["labs/**/*.ts"],
        plugins: {
            "@typescript-eslint": typescriptEslint,
            "import": eslintPluginImport,
        },
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                project: "./tsconfig.eslint.labs.json",
                ecmaVersion: 2022,
                sourceType: "module",
            },
            globals: {
                console: true,
                process: true,
                "__dirname": true,
            }
        },
        rules: {
            // Règles spécifiques pour l'environnement Node.js
            "@typescript-eslint/no-unused-vars": ["error", { 
                "vars": "all", 
                "args": "after-used", 
                "ignoreRestSiblings": true,
                "argsIgnorePattern": "^_"
            }],
            "@typescript-eslint/explicit-function-return-type": "off", // Moins strict pour le laboratoire
            "@typescript-eslint/no-explicit-any": "off", // Permettre any dans le laboratoire
            "@typescript-eslint/ban-ts-comment": "off", // Permettre les ts-ignore dans le laboratoire
            "@typescript-eslint/prefer-nullish-coalescing": "warn",
            "@typescript-eslint/prefer-optional-chain": "warn",
            "@typescript-eslint/no-empty-function": "off", // Permettre les fonctions vides dans le laboratoire
            "@typescript-eslint/no-empty-interface": "off", // Permettre les interfaces vides dans le laboratoire
            "@typescript-eslint/consistent-type-assertions": "warn",

            // Bug detection
            "no-debugger": "off", // Permettre debugger dans le laboratoire
            "no-duplicate-case": "error",
            "no-invalid-regexp": "error",
            "no-irregular-whitespace": "error",
            "no-unreachable": "error",

            "eqeqeq": ["error", "always"],
            "no-throw-literal": "error",
            "semi": ["error", "always"],
            "quotes": ["warn", "single", { "avoidEscape": true }],
            "arrow-body-style": ["warn", "as-needed"],
            "prefer-arrow-callback": "warn",
            "prefer-const": "error",
            "camelcase": ["warn", { "properties": "never" }],
            "curly": ["warn", "multi-line"],
            "no-var": "error",
            
            "import/named": "error",
            "import/default": "error",
            "import/export": "error",
            "import/no-duplicates": "error",
            "import/no-mutable-exports": "error",
            "import/no-unresolved": "off"
        },
    },

    {
        ignores: [
            "node_modules/**",
            "dist/**",
            "out/**",
            "test/**"
        ]
    }
];
