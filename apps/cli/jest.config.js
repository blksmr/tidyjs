/** @type {import('jest').Config} */
export default {
    testEnvironment: 'node',
    testMatch: ['**/apps/cli/test/**/*.test.ts'],
    moduleNameMapper: {
        '^@tidyjs/core$': '<rootDir>/../../packages/core/src/index.ts',
        '^@tidyjs/core': '<rootDir>/../../packages/core/src/index.ts',
        '^vscode$': '<rootDir>/../../packages/core/test/mocks/vscode.ts',
        '^oxc-parser$': '<rootDir>/../../packages/core/test/mocks/oxc-parser.ts',
    },
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: 'tsconfig.test.json',
        }],
    },
    rootDir: '.',
};
