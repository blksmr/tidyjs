import { ImportType } from '../../src/parser';
import { buildImportNode, buildGroupNode, buildDocument } from '../../src/ir/builders';
import { printDocument, render } from '../../src/ir/printer';

import type { ParsedImport } from '../../src/parser';
import type { Config } from '../../src/types';
import type { IRAlignAnchor } from '../../src/ir/types';

const baseConfig: Config = {
    groups: [
        { name: 'React', match: /^react$/, order: 1 },
        { name: 'Other', order: 999, default: true },
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

describe('IR Builders', () => {
    describe('buildImportNode', () => {
        it('should build side-effect import (no anchor)', () => {
            const imp = makeParsedImport({
                type: ImportType.SIDE_EFFECT,
                source: './styles.css',
                specifiers: [],
            });
            const node = buildImportNode(imp, baseConfig, 'g1');
            expect(node.kind).toBe('text');
            if (node.kind === 'text') {
                expect(node.value).toBe("import './styles.css';");
            }
        });

        it('should build default import with anchor', () => {
            const imp = makeParsedImport({
                type: ImportType.DEFAULT,
                source: 'react',
                specifiers: ['React'],
            });
            const node = buildImportNode(imp, baseConfig, 'g1');
            expect(node.kind).toBe('alignAnchor');
            if (node.kind === 'alignAnchor') {
                expect(node.groupId).toBe('g1');
            }
        });

        it('should build typeDefault import', () => {
            const imp = makeParsedImport({
                type: ImportType.TYPE_DEFAULT,
                source: 'react',
                specifiers: ['React'],
            });
            const node = buildImportNode(imp, baseConfig, 'g1');
            expect(node.kind).toBe('alignAnchor');
            if (node.kind === 'alignAnchor') {
                const anchor = node as IRAlignAnchor;
                // prefix should contain 'import type'
                const resolved = new Map<string, number>();
                const prefixStr = render(anchor.prefix, resolved);
                expect(prefixStr).toContain('import type React');
            }
        });

        it('should build single named import', () => {
            const imp = makeParsedImport({
                type: ImportType.NAMED,
                source: 'react',
                specifiers: ['useState'],
            });
            const node = buildImportNode(imp, baseConfig, 'g1');
            expect(node.kind).toBe('alignAnchor');
            if (node.kind === 'alignAnchor') {
                const resolved = new Map<string, number>();
                const prefixStr = render(node.prefix, resolved);
                expect(prefixStr).toBe('import { useState } ');
            }
        });

        it('should build single typeNamed import', () => {
            const imp = makeParsedImport({
                type: ImportType.TYPE_NAMED,
                source: 'react',
                specifiers: ['FC'],
            });
            const node = buildImportNode(imp, baseConfig, 'g1');
            expect(node.kind).toBe('alignAnchor');
            if (node.kind === 'alignAnchor') {
                const resolved = new Map<string, number>();
                const prefixStr = render(node.prefix, resolved);
                expect(prefixStr).toBe('import type { FC } ');
            }
        });

        it('should build multiline named import (multiple specifiers)', () => {
            const imp = makeParsedImport({
                type: ImportType.NAMED,
                source: 'react',
                specifiers: ['useState', 'useEffect'],
            });
            const node = buildImportNode(imp, baseConfig, 'g1');
            expect(node.kind).toBe('alignAnchor');
            if (node.kind === 'alignAnchor') {
                expect(node.idealWidth).toBeDefined();
                const resolved = new Map<string, number>();
                const prefixStr = render(node.prefix, resolved);
                expect(prefixStr).toContain('import {');
                expect(prefixStr).toContain('useState');
                expect(prefixStr).toContain('useEffect');
            }
        });

        it('should build namespace import', () => {
            const imp = makeParsedImport({
                type: ImportType.DEFAULT,
                source: './utils',
                specifiers: ['* as Utils'],
            });
            const node = buildImportNode(imp, baseConfig, 'g1');
            expect(node.kind).toBe('alignAnchor');
            if (node.kind === 'alignAnchor') {
                const resolved = new Map<string, number>();
                const prefixStr = render(node.prefix, resolved);
                expect(prefixStr).toBe('import * as Utils ');
            }
        });

        it('should build aliased import', () => {
            const imp = makeParsedImport({
                type: ImportType.NAMED,
                source: './utils',
                specifiers: [{ imported: 'foo', local: 'bar' }],
            });
            const node = buildImportNode(imp, baseConfig, 'g1');
            expect(node.kind).toBe('alignAnchor');
            if (node.kind === 'alignAnchor') {
                const resolved = new Map<string, number>();
                const prefixStr = render(node.prefix, resolved);
                expect(prefixStr).toBe('import { foo as bar } ');
            }
        });

        it('should respect double quotes config', () => {
            const config = { ...baseConfig, format: { ...baseConfig.format, singleQuote: false } };
            const imp = makeParsedImport({
                type: ImportType.DEFAULT,
                source: 'react',
                specifiers: ['React'],
            });
            const node = buildImportNode(imp, config, 'g1');
            if (node.kind === 'alignAnchor') {
                const resolved = new Map<string, number>();
                const suffixStr = render(node.suffix, resolved);
                expect(suffixStr).toBe('from "react";');
            }
        });

        it('should respect bracketSpacing: false', () => {
            const config = { ...baseConfig, format: { ...baseConfig.format, bracketSpacing: false } };
            const imp = makeParsedImport({
                type: ImportType.NAMED,
                source: 'react',
                specifiers: ['useState'],
            });
            const node = buildImportNode(imp, config, 'g1');
            if (node.kind === 'alignAnchor') {
                const resolved = new Map<string, number>();
                const prefixStr = render(node.prefix, resolved);
                expect(prefixStr).toBe('import {useState} ');
            }
        });
    });

    describe('buildGroupNode', () => {
        it('should produce comment + imports', () => {
            const imports: ParsedImport[] = [
                makeParsedImport({ type: ImportType.DEFAULT, source: 'react', specifiers: ['React'] }),
                makeParsedImport({ type: ImportType.NAMED, source: 'react', specifiers: ['useState'] }),
            ];
            const group = buildGroupNode('React', imports, baseConfig);
            expect(group.kind).toBe('alignGroup');
            expect(group.groupId).toBe('React');
            // children: text(comment), hardLine, anchor1, hardLine, anchor2
            expect(group.children.length).toBe(5);
            expect(group.children[0].kind).toBe('text');
            if (group.children[0].kind === 'text') {
                expect(group.children[0].value).toBe('// React');
            }
        });
    });

    describe('buildDocument', () => {
        it('should insert blank lines between groups', () => {
            const groups = [
                {
                    name: 'React',
                    imports: [
                        makeParsedImport({ type: ImportType.DEFAULT, source: 'react', specifiers: ['React'] }),
                    ],
                },
                {
                    name: 'Other',
                    imports: [
                        makeParsedImport({ type: ImportType.DEFAULT, source: 'lodash', specifiers: ['_'] }),
                    ],
                },
            ];

            const document = buildDocument(groups, baseConfig);
            const output = printDocument(document);
            const lines = output.split('\n');

            // Should have: // React, import React from ..., blank line, // Other, import _ from ..., trailing empty
            expect(lines[0]).toBe('// React');
            expect(lines[1]).toContain('import React');
            expect(lines[2]).toBe(''); // blank line between groups
            expect(lines[3]).toBe('// Other');
            expect(lines[4]).toContain('import _');
        });

        it('should end with trailing newline', () => {
            const groups = [
                {
                    name: 'Other',
                    imports: [
                        makeParsedImport({ type: ImportType.SIDE_EFFECT, source: './styles.css', specifiers: [] }),
                    ],
                },
            ];

            const document = buildDocument(groups, baseConfig);
            const output = printDocument(document);
            expect(output.endsWith('\n')).toBe(true);
        });

        describe('blankLinesBetweenGroups', () => {
            const twoGroups = [
                {
                    name: 'React',
                    imports: [
                        makeParsedImport({ type: ImportType.DEFAULT, source: 'react', specifiers: ['React'] }),
                    ],
                },
                {
                    name: 'Other',
                    imports: [
                        makeParsedImport({ type: ImportType.DEFAULT, source: 'lodash', specifiers: ['_'] }),
                    ],
                },
            ];

            it('blankLinesBetweenGroups: 0 — no blank lines between groups', () => {
                const config = { ...baseConfig, format: { ...baseConfig.format, blankLinesBetweenGroups: 0 } };
                const output = printDocument(buildDocument(twoGroups, config));
                const lines = output.split('\n');
                // // React, import React..., // Other (no blank line in between)
                expect(lines[0]).toBe('// React');
                expect(lines[1]).toContain('import React');
                expect(lines[2]).toBe('// Other');
            });

            it('blankLinesBetweenGroups: 1 — one blank line (default)', () => {
                const config = { ...baseConfig, format: { ...baseConfig.format, blankLinesBetweenGroups: 1 } };
                const output = printDocument(buildDocument(twoGroups, config));
                const lines = output.split('\n');
                expect(lines[2]).toBe(''); // blank line
                expect(lines[3]).toBe('// Other');
            });

            it('blankLinesBetweenGroups: 2 — two blank lines', () => {
                const config = { ...baseConfig, format: { ...baseConfig.format, blankLinesBetweenGroups: 2 } };
                const output = printDocument(buildDocument(twoGroups, config));
                const lines = output.split('\n');
                expect(lines[2]).toBe('');
                expect(lines[3]).toBe('');
                expect(lines[4]).toBe('// Other');
            });

            it('undefined — defaults to 1', () => {
                const config = { ...baseConfig, format: { ...baseConfig.format } };
                delete (config.format as Record<string, unknown>).blankLinesBetweenGroups;
                const output = printDocument(buildDocument(twoGroups, config));
                const lines = output.split('\n');
                expect(lines[2]).toBe('');
                expect(lines[3]).toBe('// Other');
            });

            it('single group — no effect', () => {
                const config = { ...baseConfig, format: { ...baseConfig.format, blankLinesBetweenGroups: 3 } };
                const singleGroup = [twoGroups[0]];
                const output = printDocument(buildDocument(singleGroup, config));
                const lines = output.split('\n');
                expect(lines[0]).toBe('// React');
                expect(lines[1]).toContain('import React');
            });
        });
    });

    describe('trailingComma', () => {
        it('always — trailing comma on last specifier', () => {
            const config = { ...baseConfig, format: { ...baseConfig.format, trailingComma: 'always' as const } };
            const imp = makeParsedImport({
                type: ImportType.NAMED,
                source: 'react',
                specifiers: ['useState', 'useEffect'],
            });
            const node = buildImportNode(imp, config, 'g1');
            if (node.kind === 'alignAnchor') {
                const resolved = new Map<string, number>();
                const prefixStr = render(node.prefix, resolved);
                // Last specifier should have a trailing comma
                const lines = prefixStr.split('\n');
                const lastSpecLine = lines[lines.length - 2]; // line before '} '
                expect(lastSpecLine.trimEnd().endsWith(',')).toBe(true);
            }
        });

        it('never — no trailing comma on last specifier', () => {
            const config = { ...baseConfig, format: { ...baseConfig.format, trailingComma: 'never' as const } };
            const imp = makeParsedImport({
                type: ImportType.NAMED,
                source: 'react',
                specifiers: ['useState', 'useEffect'],
            });
            const node = buildImportNode(imp, config, 'g1');
            if (node.kind === 'alignAnchor') {
                const resolved = new Map<string, number>();
                const prefixStr = render(node.prefix, resolved);
                const lines = prefixStr.split('\n');
                const lastSpecLine = lines[lines.length - 2];
                expect(lastSpecLine.trimEnd().endsWith(',')).toBe(false);
            }
        });

        it('undefined — defaults to never', () => {
            const config = { ...baseConfig, format: { ...baseConfig.format } };
            delete (config.format as Record<string, unknown>).trailingComma;
            const imp = makeParsedImport({
                type: ImportType.NAMED,
                source: 'react',
                specifiers: ['useState', 'useEffect'],
            });
            const node = buildImportNode(imp, config, 'g1');
            if (node.kind === 'alignAnchor') {
                const resolved = new Map<string, number>();
                const prefixStr = render(node.prefix, resolved);
                const lines = prefixStr.split('\n');
                const lastSpecLine = lines[lines.length - 2];
                expect(lastSpecLine.trimEnd().endsWith(',')).toBe(false);
            }
        });

        it('always with re-export multiline', () => {
            const config = { ...baseConfig, format: { ...baseConfig.format, trailingComma: 'always' as const } };
            const imp = makeParsedImport({
                type: ImportType.NAMED,
                source: './utils',
                specifiers: ['foo', 'bar'],
                isReExport: true,
            });
            const node = buildImportNode(imp, config, 'g1');
            if (node.kind === 'alignAnchor') {
                const resolved = new Map<string, number>();
                const prefixStr = render(node.prefix, resolved);
                expect(prefixStr).toContain('export {');
                const lines = prefixStr.split('\n');
                const lastSpecLine = lines[lines.length - 2];
                expect(lastSpecLine.trimEnd().endsWith(',')).toBe(true);
            }
        });
    });

    describe('sortSpecifiers', () => {
        it('length — sorts by string length', () => {
            const config = { ...baseConfig, format: { ...baseConfig.format, sortSpecifiers: 'length' as const } };
            const imp = makeParsedImport({
                type: ImportType.NAMED,
                source: 'react',
                specifiers: ['useCallback', 'FC', 'useState'],
            });
            const node = buildImportNode(imp, config, 'g1');
            if (node.kind === 'alignAnchor') {
                const resolved = new Map<string, number>();
                const prefixStr = render(node.prefix, resolved);
                const lines = prefixStr.split('\n').filter(l => l.trim().startsWith('FC') || l.trim().startsWith('use'));
                expect(lines[0].trim().replace(',', '')).toBe('FC');
                expect(lines[1].trim().replace(',', '')).toBe('useState');
                expect(lines[2].trim().replace(',', '')).toBe('useCallback');
            }
        });

        it('alpha — sorts alphabetically case-insensitive', () => {
            const config = { ...baseConfig, format: { ...baseConfig.format, sortSpecifiers: 'alpha' as const } };
            const imp = makeParsedImport({
                type: ImportType.NAMED,
                source: 'react',
                specifiers: ['useState', 'FC', 'useEffect'],
            });
            const node = buildImportNode(imp, config, 'g1');
            if (node.kind === 'alignAnchor') {
                const resolved = new Map<string, number>();
                const prefixStr = render(node.prefix, resolved);
                const lines = prefixStr.split('\n').filter(l => l.trim().startsWith('FC') || l.trim().startsWith('use'));
                expect(lines[0].trim().replace(',', '')).toBe('FC');
                expect(lines[1].trim().replace(',', '')).toBe('useEffect');
                expect(lines[2].trim().replace(',', '')).toBe('useState');
            }
        });

        it('false — preserves original order', () => {
            const config = { ...baseConfig, format: { ...baseConfig.format, sortSpecifiers: false as const } };
            const imp = makeParsedImport({
                type: ImportType.NAMED,
                source: 'react',
                specifiers: ['useState', 'FC', 'useEffect'],
            });
            const node = buildImportNode(imp, config, 'g1');
            if (node.kind === 'alignAnchor') {
                const resolved = new Map<string, number>();
                const prefixStr = render(node.prefix, resolved);
                const lines = prefixStr.split('\n').filter(l => l.trim().startsWith('FC') || l.trim().startsWith('use'));
                expect(lines[0].trim().replace(',', '')).toBe('useState');
                expect(lines[1].trim().replace(',', '')).toBe('FC');
                expect(lines[2].trim().replace(',', '')).toBe('useEffect');
            }
        });

        it('undefined — defaults to length', () => {
            const config = { ...baseConfig, format: { ...baseConfig.format } };
            delete (config.format as Record<string, unknown>).sortSpecifiers;
            const imp = makeParsedImport({
                type: ImportType.NAMED,
                source: 'react',
                specifiers: ['useCallback', 'FC', 'useState'],
            });
            const node = buildImportNode(imp, config, 'g1');
            if (node.kind === 'alignAnchor') {
                const resolved = new Map<string, number>();
                const prefixStr = render(node.prefix, resolved);
                const lines = prefixStr.split('\n').filter(l => l.trim().startsWith('FC') || l.trim().startsWith('use'));
                expect(lines[0].trim().replace(',', '')).toBe('FC');
                expect(lines[1].trim().replace(',', '')).toBe('useState');
                expect(lines[2].trim().replace(',', '')).toBe('useCallback');
            }
        });

        it('aliased specifiers — sorted by full string', () => {
            const config = { ...baseConfig, format: { ...baseConfig.format, sortSpecifiers: 'alpha' as const } };
            const imp = makeParsedImport({
                type: ImportType.NAMED,
                source: './utils',
                specifiers: [
                    { imported: 'zoo', local: 'z' },
                    'abc',
                    { imported: 'def', local: 'mno' },
                ],
            });
            const node = buildImportNode(imp, config, 'g1');
            if (node.kind === 'alignAnchor') {
                const resolved = new Map<string, number>();
                const prefixStr = render(node.prefix, resolved);
                const specLines = prefixStr.split('\n').filter(l => l.trim() && !l.includes('{') && !l.includes('}'));
                expect(specLines[0]).toContain('abc');
                expect(specLines[1]).toContain('def as mno');
                expect(specLines[2]).toContain('zoo as z');
            }
        });

        it('dedup works regardless of sort mode', () => {
            const config = { ...baseConfig, format: { ...baseConfig.format, sortSpecifiers: 'alpha' as const } };
            const imp = makeParsedImport({
                type: ImportType.NAMED,
                source: 'react',
                specifiers: ['useState', 'FC', 'useState'],
            });
            const node = buildImportNode(imp, config, 'g1');
            if (node.kind === 'alignAnchor') {
                const resolved = new Map<string, number>();
                const prefixStr = render(node.prefix, resolved);
                const useStateCount = (prefixStr.match(/useState/g) || []).length;
                expect(useStateCount).toBe(1);
            }
        });
    });
});
