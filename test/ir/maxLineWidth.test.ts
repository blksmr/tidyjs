import { ImportType } from '../../src/parser';
import { buildImportNode } from '../../src/ir/builders';
import { render } from '../../src/ir/printer';

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

function getRendered(node: ReturnType<typeof buildImportNode>): string {
    if (node.kind === 'alignAnchor') {
        const resolved = new Map<string, number>();
        return render(node.prefix, resolved) + render(node.suffix, resolved);
    }
    if (node.kind === 'text') {
        return node.value;
    }
    return '';
}

describe('maxLineWidth', () => {
    it('0 (disabled) — multi-specifier always multiline', () => {
        const config = { ...baseConfig, format: { ...baseConfig.format, maxLineWidth: 0 } };
        const imp = makeParsedImport({
            type: ImportType.NAMED,
            source: 'react',
            specifiers: ['FC', 'useState'],
        });
        const node = buildImportNode(imp, config, 'g1');
        const text = getRendered(node);
        expect(text).toContain('\n');
    });

    it('undefined — multi-specifier always multiline', () => {
        const config = { ...baseConfig, format: { ...baseConfig.format } };
        delete (config.format as Record<string, unknown>).maxLineWidth;
        const imp = makeParsedImport({
            type: ImportType.NAMED,
            source: 'react',
            specifiers: ['FC', 'useState'],
        });
        const node = buildImportNode(imp, config, 'g1');
        const text = getRendered(node);
        expect(text).toContain('\n');
    });

    it('large value — short import stays single-line', () => {
        const config = { ...baseConfig, format: { ...baseConfig.format, maxLineWidth: 120 } };
        const imp = makeParsedImport({
            type: ImportType.NAMED,
            source: 'react',
            specifiers: ['FC', 'useState'],
        });
        const node = buildImportNode(imp, config, 'g1');
        const text = getRendered(node);
        // Should be single-line: import { FC, useState } from 'react';
        expect(text).not.toContain('\n');
        expect(text).toContain('FC, useState');
    });

    it('small value — even short import goes multiline', () => {
        const config = { ...baseConfig, format: { ...baseConfig.format, maxLineWidth: 30 } };
        const imp = makeParsedImport({
            type: ImportType.NAMED,
            source: 'react',
            specifiers: ['FC', 'useState'],
        });
        const node = buildImportNode(imp, config, 'g1');
        const text = getRendered(node);
        expect(text).toContain('\n');
    });

    it('80 — 3 specifiers that fit stay single-line', () => {
        const config = { ...baseConfig, format: { ...baseConfig.format, maxLineWidth: 80 } };
        const imp = makeParsedImport({
            type: ImportType.NAMED,
            source: 'react',
            specifiers: ['FC', 'useState', 'useRef'],
        });
        const node = buildImportNode(imp, config, 'g1');
        const text = getRendered(node);
        // "import { FC, useRef, useState } from 'react';" = ~45 chars — fits in 80
        expect(text).not.toContain('\n');
    });

    it('80 — long import goes multiline', () => {
        const config = { ...baseConfig, format: { ...baseConfig.format, maxLineWidth: 80 } };
        const imp = makeParsedImport({
            type: ImportType.NAMED,
            source: '@very/long/package/name/that/is/really/deep',
            specifiers: ['useSomethingVeryLong', 'useAnotherVeryLongHook', 'SomeComponentName'],
        });
        const node = buildImportNode(imp, config, 'g1');
        const text = getRendered(node);
        expect(text).toContain('\n');
    });

    it('does not affect default imports', () => {
        const config = { ...baseConfig, format: { ...baseConfig.format, maxLineWidth: 10 } };
        const imp = makeParsedImport({
            type: ImportType.DEFAULT,
            source: 'react',
            specifiers: ['React'],
        });
        const node = buildImportNode(imp, config, 'g1');
        const text = getRendered(node);
        expect(text).not.toContain('\n');
    });

    it('does not affect side-effect imports', () => {
        const config = { ...baseConfig, format: { ...baseConfig.format, maxLineWidth: 10 } };
        const imp = makeParsedImport({
            type: ImportType.SIDE_EFFECT,
            source: './styles.css',
            specifiers: [],
        });
        const node = buildImportNode(imp, config, 'g1');
        const text = getRendered(node);
        expect(text).not.toContain('\n');
    });

    it('typeNamed imports respect maxLineWidth', () => {
        const config = { ...baseConfig, format: { ...baseConfig.format, maxLineWidth: 120 } };
        const imp = makeParsedImport({
            type: ImportType.TYPE_NAMED,
            source: 'react',
            specifiers: ['FC', 'ReactNode'],
        });
        const node = buildImportNode(imp, config, 'g1');
        const text = getRendered(node);
        expect(text).not.toContain('\n');
        expect(text).toContain('import type { FC, ReactNode }');
    });

    it('re-exports respect maxLineWidth', () => {
        const config = { ...baseConfig, format: { ...baseConfig.format, maxLineWidth: 120 } };
        const imp = makeParsedImport({
            type: ImportType.NAMED,
            source: './utils',
            specifiers: ['foo', 'bar'],
            isReExport: true,
        });
        const node = buildImportNode(imp, config, 'g1');
        const text = getRendered(node);
        expect(text).not.toContain('\n');
        expect(text).toMatch(/export \{ (foo, bar|bar, foo) \}/);
    });

    it('interaction with trailingComma — does not affect single-line calc', () => {
        const config = { ...baseConfig, format: { ...baseConfig.format, maxLineWidth: 120, trailingComma: 'always' as const } };
        const imp = makeParsedImport({
            type: ImportType.NAMED,
            source: 'react',
            specifiers: ['FC', 'useState'],
        });
        const node = buildImportNode(imp, config, 'g1');
        const text = getRendered(node);
        // Single-line should not have trailing comma
        expect(text).not.toContain('\n');
        expect(text).toContain('FC, useState');
    });

    it('interaction with sortSpecifiers — alpha sort changes join order', () => {
        const config = { ...baseConfig, format: { ...baseConfig.format, maxLineWidth: 120, sortSpecifiers: 'alpha' as const } };
        const imp = makeParsedImport({
            type: ImportType.NAMED,
            source: 'react',
            specifiers: ['useState', 'FC', 'useEffect'],
        });
        const node = buildImportNode(imp, config, 'g1');
        const text = getRendered(node);
        expect(text).not.toContain('\n');
        expect(text).toContain('FC, useEffect, useState');
    });
});
