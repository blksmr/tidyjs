module.exports = {
    testEnvironment: 'node',
    testMatch: [
        "**/unit/**/*.ts",
        "**/parser/**/*.ts",
        "**/configLoader/**/*.ts",
        "**/path-resolver/**/*.ts",
        "**/test/ir/**/*.ts"
    ],
    moduleNameMapper: {
        "^vscode$": "<rootDir>/test/mocks/vscode.js",
        "^oxc-parser$": "<rootDir>/test/mocks/oxc-parser.js"
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
