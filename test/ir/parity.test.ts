/**
 * Parity tests: run both the old formatter pipeline and the new IR pipeline
 * on the same inputs and assert identical output.
 *
 * Strategy: The old formatter produces a full document (imports + rest of code).
 * The IR pipeline produces only the import block (with trailing newline).
 * We extract the import block from the old output and compare.
 */

import { parseImports } from '../../src/parser';
import { formatImports } from '../../src/formatter';
import { buildDocument } from '../../src/ir/builders';
import { printDocument } from '../../src/ir/printer';

import type { ParsedImport, ParserResult } from '../../src/parser';
import type { Config } from '../../src/types';

// ── Helpers ──────────────────────────────────────────────────────────

function irFormat(parserResult: ParserResult, config: Config): string {
    const importsByGroup: Record<string, { order: number; imports: ParsedImport[] }> = {};

    parserResult.groups.forEach((group) => {
        if (group.imports?.length) {
            importsByGroup[group.name] = {
                order: group.order,
                imports: group.imports,
            };
        }
    });

    const entries = Object.entries(importsByGroup);
    entries.sort(([, a], [, b]) => a.order - b.order);

    const groups = entries.map(([name, { imports }]) => ({ name, imports }));
    const document = buildDocument(groups, config);
    return printDocument(document);
}

/**
 * Extract the import block from the formatted source.
 * The old formatter replaces the import section in-place.
 * We use a simple strategy: the old formatter always produces
 * an import block ending with an empty line, followed by non-import code.
 * We parse the full output, find the last import/comment line,
 * and extract everything up to (and including) the trailing empty line.
 */
function extractImportBlock(formattedSource: string): string {
    const lines = formattedSource.split('\n');
    let lastImportOrCommentLine = -1;

    let inMultilineImport = false;
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();

        if (inMultilineImport) {
            lastImportOrCommentLine = i;
            if (trimmed.includes('from ')) {
                inMultilineImport = false;
            }
            continue;
        }

        if (trimmed.startsWith('import ')) {
            // Check if it's the start of a multiline import
            if (trimmed.startsWith('import {') && !trimmed.includes('from ') && !trimmed.includes("from '") && !trimmed.includes('from "')) {
                inMultilineImport = true;
            }
            if (trimmed.startsWith('import type {') && !trimmed.includes('from ') && !trimmed.includes("from '") && !trimmed.includes('from "')) {
                inMultilineImport = true;
            }
            lastImportOrCommentLine = i;
        } else if (trimmed.startsWith('//') && lastImportOrCommentLine === -1 || (lastImportOrCommentLine >= 0 && (i - lastImportOrCommentLine) <= 2 && trimmed.startsWith('//'))) {
            lastImportOrCommentLine = i;
        } else if (trimmed === '' && lastImportOrCommentLine >= 0) {
            // Could be inter-group blank line or trailing blank line
            // Peek ahead to see if next non-empty line is still import/comment
            let nextNonEmpty = -1;
            for (let j = i + 1; j < lines.length; j++) {
                if (lines[j].trim() !== '') {
                    nextNonEmpty = j;
                    break;
                }
            }
            if (nextNonEmpty >= 0 && (lines[nextNonEmpty].trim().startsWith('import ') || lines[nextNonEmpty].trim().startsWith('//'))) {
                lastImportOrCommentLine = i;
            } else {
                // End of import block — include this empty line as trailing
                return lines.slice(0, i + 1).join('\n');
            }
        }
    }

    // If we got here, file ends with imports
    if (lastImportOrCommentLine >= 0) {
        const result = lines.slice(0, lastImportOrCommentLine + 1);
        result.push('');
        return result.join('\n');
    }

    return '';
}

// ── Configs ──────────────────────────────────────────────────────────

const defaultConfig: Config = {
    groups: [
        { name: 'React', match: /^react$/, order: 1, default: false },
        { name: 'Other', order: 999, default: true },
    ],
    importOrder: { default: 1, named: 2, typeOnly: 3, sideEffect: 0 },
    format: { singleQuote: true, indent: 4, bracketSpacing: true },
};

const doubleQuoteConfig: Config = {
    ...defaultConfig,
    format: { ...defaultConfig.format, singleQuote: false },
};

const indent2Config: Config = {
    ...defaultConfig,
    format: { ...defaultConfig.format, indent: 2 },
};

const noBracketSpacingConfig: Config = {
    ...defaultConfig,
    format: { ...defaultConfig.format, bracketSpacing: false },
};

const multiGroupConfig: Config = {
    groups: [
        { name: 'React', match: /^react/, order: 1, default: false },
        { name: 'External', match: /^[^@.]/, order: 2, default: false },
        { name: 'Internal', match: /^@\//, order: 3, default: false },
        { name: 'Other', order: 999, default: true },
    ],
    importOrder: { sideEffect: 0, default: 1, named: 2, typeOnly: 3 },
    format: { singleQuote: true, indent: 4, bracketSpacing: true },
};

// ── Test cases ───────────────────────────────────────────────────────

describe('IR Parity Tests', () => {
    async function assertParity(sourceCode: string, config: Config): Promise<void> {
        const parserResult = parseImports(sourceCode, config);

        if (!parserResult.importRange || parserResult.importRange.start === parserResult.importRange.end) {
            return;
        }
        if (parserResult.groups.every((g) => g.imports.length === 0)) {
            return;
        }

        // Old pipeline
        const oldResult = await formatImports(sourceCode, config, parserResult);
        const oldImportBlock = extractImportBlock(oldResult.text);

        // New IR pipeline
        const irOutput = irFormat(parserResult, config);

        expect(irOutput).toBe(oldImportBlock);
    }

    describe('Simple imports', () => {
        it('default import', async () => {
            await assertParity("import React from 'react';\n\nconst x = 1;", defaultConfig);
        });

        it('named import with single specifier', async () => {
            await assertParity("import { useState } from 'react';\n\nconst x = 1;", defaultConfig);
        });

        it('side-effect import', async () => {
            await assertParity("import './styles.css';\n\nconst x = 1;", defaultConfig);
        });

        it('namespace import', async () => {
            await assertParity("import * as Utils from './utils';\n\nconst x = 1;", defaultConfig);
        });

        it('aliased import', async () => {
            await assertParity("import { foo as bar } from './utils';\n\nconst x = 1;", defaultConfig);
        });
    });

    describe('Type imports', () => {
        it('type default import', async () => {
            await assertParity("import type React from 'react';\n\nconst x = 1;", defaultConfig);
        });

        it('type named single', async () => {
            await assertParity("import type { FC } from 'react';\n\nconst x = 1;", defaultConfig);
        });

        it('type named multi', async () => {
            await assertParity(
                "import type { FC, ReactNode, ComponentType } from 'react';\n\nconst x = 1;",
                defaultConfig
            );
        });
    });

    describe('Multiline imports', () => {
        it('named multi specifiers', async () => {
            await assertParity(
                "import { useState, useEffect, useCallback } from 'react';\n\nconst x = 1;",
                defaultConfig
            );
        });

        it('mixed single and multiline in same group', async () => {
            await assertParity(
                "import React from 'react';\nimport { useState, useEffect, useCallback } from 'react';\n\nconst x = 1;",
                defaultConfig
            );
        });
    });

    describe('Multiple groups', () => {
        it('two groups with different alignment widths', async () => {
            await assertParity(
                "import React from 'react';\nimport { useState } from 'react';\nimport lodash from 'lodash';\n\nconst x = 1;",
                defaultConfig
            );
        });
    });

    describe('Config variations', () => {
        it('double quotes', async () => {
            await assertParity(
                "import React from 'react';\nimport { useState } from 'react';\n\nconst x = 1;",
                doubleQuoteConfig
            );
        });

        it('indent: 2', async () => {
            await assertParity(
                "import { useState, useEffect, useCallback } from 'react';\n\nconst x = 1;",
                indent2Config
            );
        });

        it('bracketSpacing: false', async () => {
            await assertParity(
                "import { useState } from 'react';\n\nconst x = 1;",
                noBracketSpacingConfig
            );
        });
    });

    describe('Complex scenarios', () => {
        it('default + named + type in same group', async () => {
            await assertParity(
                "import React from 'react';\nimport { useState } from 'react';\nimport type { FC } from 'react';\n\nconst x = 1;",
                defaultConfig
            );
        });

        it('multiple groups with multi imports', async () => {
            await assertParity(
                [
                    "import React from 'react';",
                    "import { useState, useEffect } from 'react';",
                    "import lodash from 'lodash';",
                    "import { debounce } from 'lodash';",
                    "import { helper } from '@/utils';",
                    '',
                    'const x = 1;',
                ].join('\n'),
                multiGroupConfig
            );
        });

        it('side-effect + default + named mixed', async () => {
            await assertParity(
                [
                    "import './polyfills';",
                    "import React from 'react';",
                    "import { useState, useEffect, useMemo, useCallback } from 'react';",
                    "import type { FC, ReactNode } from 'react';",
                    '',
                    'const x = 1;',
                ].join('\n'),
                defaultConfig
            );
        });
    });
});
