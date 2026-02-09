/** @type {import('jest').Config} */
export default {
    testEnvironment: 'node',
    testMatch: [
        "**/unit/**/*.ts",
        "**/parser/**/*.ts",
        "**/configLoader/**/*.ts",
        "**/path-resolver/**/*.ts",
        "**/test/ir/**/*.ts"
    ],
    moduleNameMapper: {
        "^vscode$": "<rootDir>/test/mocks/vscode.ts",
        "^oxc-parser$": "<rootDir>/test/mocks/oxc-parser.ts"
    },
    transform: {
        "^.+\\.tsx?$": "ts-jest"
    },
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    testPathIgnorePatterns: [
        "/node_modules/",
        "/.vscode-test/"
    ],
    modulePathIgnorePatterns: [
        "/.vscode-test/"
    ]
};
