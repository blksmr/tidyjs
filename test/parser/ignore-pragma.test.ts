import { ImportParser } from '../../src/parser';
import { formatImports } from '../../src/formatter';
import type { Config } from '../../src/types';

const baseConfig: Config = {
    groups: [{ name: 'Other', order: 0, default: true }],
    importOrder: { default: 0, named: 1, typeOnly: 2, sideEffect: 3 },
    format: { indent: 4, singleQuote: true, bracketSpacing: true },
};

/**
 * The hasIgnorePragma function is internal to extension.ts.
 * We replicate its logic here to unit-test the regex independently.
 */
function hasIgnorePragma(text: string): boolean {
    return /^\s*\/\/\s*tidyjs-ignore\s*$/m.test(text);
}

describe('tidyjs-ignore pragma', () => {
    describe('hasIgnorePragma detection', () => {
        test('detects pragma at the first line', () => {
            const text = `// tidyjs-ignore\nimport React from 'react';`;
            expect(hasIgnorePragma(text)).toBe(true);
        });

        test('detects pragma with leading spaces', () => {
            const text = `  // tidyjs-ignore\nimport React from 'react';`;
            expect(hasIgnorePragma(text)).toBe(true);
        });

        test('detects pragma with extra spaces around keyword', () => {
            const text = `//   tidyjs-ignore  \nimport React from 'react';`;
            expect(hasIgnorePragma(text)).toBe(true);
        });

        test('detects pragma in the middle of the file', () => {
            const text = `import React from 'react';\n// tidyjs-ignore\nimport { useState } from 'react';`;
            expect(hasIgnorePragma(text)).toBe(true);
        });

        test('does NOT match pragma as substring (tidyjs-ignore-next-line)', () => {
            const text = `// tidyjs-ignore-next-line\nimport React from 'react';`;
            expect(hasIgnorePragma(text)).toBe(false);
        });

        test('does NOT match pragma inside block comment', () => {
            const text = `/* tidyjs-ignore */\nimport React from 'react';`;
            expect(hasIgnorePragma(text)).toBe(false);
        });

        test('does NOT match pragma in a string literal', () => {
            const text = `const x = '// tidyjs-ignore';\nimport React from 'react';`;
            expect(hasIgnorePragma(text)).toBe(false);
        });

        test('returns false when no pragma is present', () => {
            const text = `import React from 'react';\nimport { useState } from 'react';`;
            expect(hasIgnorePragma(text)).toBe(false);
        });

        test('returns false on empty text', () => {
            expect(hasIgnorePragma('')).toBe(false);
        });
    });

    describe('formatting still works without pragma', () => {
        test('imports are organized when no pragma is present', async () => {
            const source = `import { useState } from 'react';\nimport React from 'react';\n`;
            const parser = new ImportParser(baseConfig);
            const result = parser.parse(source);
            const formatted = await formatImports(source, baseConfig, result);

            expect(formatted.text).not.toBe(source);
        });
    });
});
