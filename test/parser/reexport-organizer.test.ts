import { organizeReExports } from '../../src/reexport-organizer';
import type { Config } from '../../src/types';

const baseConfig: Config = {
    groups: [
        { name: 'React', order: 0, match: /^react/ },
        { name: 'External', order: 1, match: /^[^@.]/ },
        { name: 'Internal', order: 2, match: /^@\// },
        { name: 'Relative', order: 3, match: /^\./, default: true },
    ],
    importOrder: { default: 0, named: 1, typeOnly: 2, sideEffect: 3 },
    format: { indent: 4, singleQuote: true, bracketSpacing: true, organizeReExports: true },
};

describe('organizeReExports', () => {
    test('groups and sorts re-exports by config groups', () => {
        const source = [
            "export { Button } from './components';",
            "export { useState } from 'react';",
            "export { cloneDeep } from 'lodash';",
            '',
        ].join('\n');

        const result = organizeReExports(source, baseConfig);
        const lines = result.split('\n');

        // React group first
        expect(lines).toContain('// React');
        // External group second
        expect(lines).toContain('// External');
        // Relative group last
        expect(lines).toContain('// Relative');

        // React before External in output
        const reactIdx = lines.indexOf('// React');
        const externalIdx = lines.indexOf('// External');
        const relativeIdx = lines.indexOf('// Relative');
        expect(reactIdx).toBeLessThan(externalIdx);
        expect(externalIdx).toBeLessThan(relativeIdx);
    });

    test('aligns from keywords within a group', () => {
        const source = [
            "export { Button } from './components';",
            "export { TextField } from './components/forms';",
            '',
        ].join('\n');

        const result = organizeReExports(source, baseConfig);
        const exportLines = result.split('\n').filter(l => l.startsWith('export'));

        // Both lines should have `from` at the same column
        const fromPositions = exportLines.map(l => l.indexOf('from'));
        expect(fromPositions[0]).toBe(fromPositions[1]);
    });

    test('separates named and type re-exports', () => {
        const source = [
            "export type { ButtonProps } from './components';",
            "export { Button } from './components';",
            '',
        ].join('\n');

        const result = organizeReExports(source, baseConfig);
        const exportLines = result.split('\n').filter(l => l.startsWith('export'));

        // Named before type
        expect(exportLines[0]).toContain('export {');
        expect(exportLines[1]).toContain('export type {');
    });

    test('handles multiline re-exports', () => {
        const source = [
            "export { Button, TextField, Checkbox } from './components';",
            "export { Modal } from './overlays';",
            '',
        ].join('\n');

        const result = organizeReExports(source, baseConfig);
        // Should contain the re-export with multiple specifiers
        expect(result).toContain('Button');
        expect(result).toContain('TextField');
        expect(result).toContain('Checkbox');
    });

    test('returns text unchanged when no re-exports are found', () => {
        const source = [
            "import React from 'react';",
            "const x = 1;",
            '',
        ].join('\n');

        const result = organizeReExports(source, baseConfig);
        expect(result).toBe(source);
    });

    test('requires at least 2 re-exports to form a block', () => {
        const source = [
            "export { Button } from './components';",
            '',
        ].join('\n');

        const result = organizeReExports(source, baseConfig);
        expect(result).toBe(source);
    });

    test('preserves code between re-export blocks', () => {
        const source = [
            "export { Button } from './components';",
            "export { Modal } from './overlays';",
            '',
            'const x = 1;',
            '',
            "export { Input } from './forms';",
            "export { Select } from './forms';",
            '',
        ].join('\n');

        const result = organizeReExports(source, baseConfig);
        expect(result).toContain('const x = 1;');
    });

    test('handles barrel file (all re-exports)', () => {
        const source = [
            "export { useState } from 'react';",
            "export { cloneDeep } from 'lodash';",
            "export { Button } from './components';",
            "export { api } from '@/services';",
            '',
        ].join('\n');

        const result = organizeReExports(source, baseConfig);
        // Should have group comments
        expect(result).toContain('// React');
        expect(result).toContain('// External');
    });

    test('handles aliased re-exports', () => {
        const source = [
            "export { default as Button } from './Button';",
            "export { default as Input } from './Input';",
            '',
        ].join('\n');

        const result = organizeReExports(source, baseConfig);
        expect(result).toContain('default as Button');
        expect(result).toContain('default as Input');
    });

    test('does not crash on invalid syntax', () => {
        const source = 'export { const = what ';
        const result = organizeReExports(source, baseConfig);
        expect(result).toBe(source);
    });

    test('uses double quotes when configured', () => {
        const doubleQuoteConfig: Config = {
            ...baseConfig,
            format: { ...baseConfig.format, singleQuote: false },
        };

        const source = [
            "export { Button } from './components';",
            "export { Modal } from './overlays';",
            '',
        ].join('\n');

        const result = organizeReExports(source, doubleQuoteConfig);
        expect(result).toContain('"./components"');
        expect(result).toContain('"./overlays"');
    });

    test('sorts alphabetically by source within same type', () => {
        const source = [
            "export { z } from './z-module';",
            "export { a } from './a-module';",
            "export { m } from './m-module';",
            '',
        ].join('\n');

        const result = organizeReExports(source, baseConfig);
        const exportLines = result.split('\n').filter(l => l.startsWith('export'));

        // Should be sorted: a-module, m-module, z-module
        expect(exportLines[0]).toContain('a-module');
        expect(exportLines[1]).toContain('m-module');
        expect(exportLines[2]).toContain('z-module');
    });
});
