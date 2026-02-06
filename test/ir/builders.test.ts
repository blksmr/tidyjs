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
    });
});
