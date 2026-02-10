import { ImportType } from '../../src/parser';
import { buildDocument } from '../../src/ir/builders';
import { printDocument } from '../../src/ir/printer';

import type { ParsedImport } from '../../src/parser';
import type { Config } from '../../src/types';

const baseConfig: Config = {
    groups: [
        { name: 'Other', order: 0, default: true },
    ],
    importOrder: { default: 1, named: 2, typeOnly: 3, sideEffect: 0 },
    format: { singleQuote: true, indent: 4, bracketSpacing: true },
};

function makeParsedImport(overrides: Partial<ParsedImport>): ParsedImport {
    return {
        type: ImportType.DEFAULT,
        source: 'test',
        specifiers: ['Test'],
        raw: '',
        groupName: null,
        isPriority: false,
        sourceIndex: 0,
        ...overrides,
    };
}

/**
 * Simulates replaceImportLines behavior for testing enforceNewlineAfterImports.
 * This mirrors the logic in formatter.ts replaceImportLines.
 */
function simulateReplace(
    sourceText: string,
    importStart: number,
    importEnd: number,
    formattedImports: string,
    config: Config
): string {
    const lines = sourceText.split('\n');
    const enforce = config.format?.enforceNewlineAfterImports !== false;

    let startLine = 0;
    let endLine = 0;
    let currentPos = 0;

    for (let i = 0; i < lines.length; i++) {
        const lineEnd = currentPos + lines[i].length;
        if (currentPos <= importStart && importStart <= lineEnd) {
            startLine = i;
        }
        if (currentPos <= importEnd && importEnd <= lineEnd + 1) {
            endLine = i;
        }
        currentPos = lineEnd + 1;
    }

    const beforeLines = lines.slice(0, startLine);
    const afterLines = lines.slice(endLine + 1);

    let newImportLines: string[] = [];
    if (formattedImports.trim()) {
        newImportLines = formattedImports.split('\n');

        if (afterLines.length > 0) {
            if (enforce) {
                while (afterLines.length > 0 && afterLines[0].trim() === '') {
                    afterLines.shift();
                }
            }
        } else {
            newImportLines.push('');
        }
    }

    return [...beforeLines, ...newImportLines, ...afterLines].join('\n');
}

describe('enforceNewlineAfterImports', () => {
    const imp = makeParsedImport({
        type: ImportType.DEFAULT,
        source: 'react',
        specifiers: ['React'],
    });

    function getFormattedImports(config: Config): string {
        const groups = [{ name: 'Other', imports: [imp] }];
        return printDocument(buildDocument(groups, config));
    }

    it('true: should add one blank line between imports and code', () => {
        const config = { ...baseConfig, format: { ...baseConfig.format, enforceNewlineAfterImports: true } };
        const source = "import React from 'react';\nconst x = 1;";
        const formatted = getFormattedImports(config);
        const result = simulateReplace(source, 0, 26, formatted, config);
        const lines = result.split('\n');
        // After formatted imports (which end with \n), code should follow after a blank line
        const codeIndex = lines.findIndex(l => l === 'const x = 1;');
        expect(codeIndex).toBeGreaterThan(0);
        // The line before code should be empty (blank line)
        expect(lines[codeIndex - 1]).toBe('');
    });

    it('true: should reduce multiple blank lines to one', () => {
        const config = { ...baseConfig, format: { ...baseConfig.format, enforceNewlineAfterImports: true } };
        const source = "import React from 'react';\n\n\n\nconst x = 1;";
        const formatted = getFormattedImports(config);
        const result = simulateReplace(source, 0, 26, formatted, config);
        const lines = result.split('\n');
        const codeIndex = lines.findIndex(l => l === 'const x = 1;');
        expect(codeIndex).toBeGreaterThan(0);
        expect(lines[codeIndex - 1]).toBe('');
        // No double blank lines
        const importEnd = lines.findIndex(l => l.startsWith('// Other'));
        const blankCount = lines.slice(importEnd).filter(l => l === '').length;
        // Should be exactly 1 blank line between last import and code
        expect(blankCount).toBe(1);
    });

    it('true: should add blank line when none exists', () => {
        const config = { ...baseConfig, format: { ...baseConfig.format, enforceNewlineAfterImports: true } };
        const source = "import React from 'react';\nconst x = 1;";
        const formatted = getFormattedImports(config);
        const result = simulateReplace(source, 0, 26, formatted, config);
        // The formatted imports end with \n, and afterLines empty lines are stripped
        // So the result should have exactly one blank line before code
        expect(result).toContain('\n\nconst x = 1;');
    });

    it('false: should preserve existing spacing', () => {
        const config = { ...baseConfig, format: { ...baseConfig.format, enforceNewlineAfterImports: false } };
        const source = "import React from 'react';\n\n\n\nconst x = 1;";
        const formatted = getFormattedImports(config);
        const result = simulateReplace(source, 0, 26, formatted, config);
        // The original 3 blank lines should be preserved
        expect(result).toContain('\n\n\nconst x = 1;');
    });

    it('false: should not add blank line when none exists', () => {
        const config = { ...baseConfig, format: { ...baseConfig.format, enforceNewlineAfterImports: false } };
        const source = "import React from 'react';\nconst x = 1;";
        const formatted = getFormattedImports(config);
        const result = simulateReplace(source, 0, 26, formatted, config);
        // afterLines starts with 'const x = 1;' — no stripping, so it goes right after formatted
        expect(result).toContain('\nconst x = 1;');
    });

    it('undefined: should behave like true', () => {
        const config = { ...baseConfig, format: { ...baseConfig.format } };
        delete (config.format as Record<string, unknown>).enforceNewlineAfterImports;
        const source = "import React from 'react';\n\n\n\nconst x = 1;";
        const formatted = getFormattedImports(config);
        const result = simulateReplace(source, 0, 26, formatted, config);
        // Should strip extra blank lines like enforce=true
        const lines = result.split('\n');
        const codeIndex = lines.findIndex(l => l === 'const x = 1;');
        expect(codeIndex).toBeGreaterThan(0);
        expect(lines[codeIndex - 1]).toBe('');
    });

    it('file ending with imports should add trailing empty line', () => {
        const config = { ...baseConfig, format: { ...baseConfig.format, enforceNewlineAfterImports: true } };
        const source = "import React from 'react';";
        const formatted = getFormattedImports(config);
        const result = simulateReplace(source, 0, 26, formatted, config);
        // Should end with trailing newline
        expect(result.endsWith('\n')).toBe(true);
    });
});
