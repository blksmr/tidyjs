/** @type {import('jest').Config} */
export default {
    testEnvironment: 'node',
    testMatch: [
        '**/apps/vscode/test/**/*.test.ts'
    ],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/.vscode-test/',
        '/test/e2e/'
    ],
    moduleNameMapper: {
        '^vscode$': '<rootDir>/test/mocks/vscode.ts',
        '^oxc-parser$': '<rootDir>/test/mocks/oxc-parser.ts'
    },
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: 'tsconfig.test.json'
        }]
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    rootDir: '.',
    modulePathIgnorePatterns: [
        '/.vscode-test/'
    ]
};
