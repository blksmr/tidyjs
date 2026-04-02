import { ImportParser } from '../../src/parser';
import { Config } from '../../src/types';
import { formatImports } from '../../src/formatter';

describe('Orphaned group comment after last import', () => {
    const config: Config = {
        groups: [
            { name: '@app/dossier', order: 3, match: /^@app\/dossier/, priority: 1 },
            { name: 'DS', order: 2, match: /^ds$/ },
            { name: 'Misc', order: 1, match: /^[\w@]/ },
        ],
        importOrder: {
            default: 1,
            named: 2,
            typeOnly: 3,
            sideEffect: 0,
        },
    };

    it('should remove orphaned group comment after last import', async () => {
        const code = `// Misc
import { join }            from 'lodash';
import type { FC }         from 'react';

// DS
import { YpElement }       from 'ds';

// @app/dossier
import type { FicheModel } from '@app/dossier/models/FicheModel';

// @app/dossier

type TProps = {
    isOpen: boolean;
};`;

        const parser = new ImportParser(config);
        const result = parser.parse(code);
        const formatted = await formatImports(code, config, result);

        // The orphaned "// @app/dossier" should NOT survive formatting
        const importSection = formatted.text.split('type TProps')[0];
        const matches = importSection.match(/\/\/ @app\/dossier/g);
        expect(matches).toHaveLength(1);
    });

    it('should not consume code comments directly after imports (no blank line)', async () => {
        const code = `import React from 'react';
import { useState } from 'react';
// This is a code comment
const Component = () => {};`;

        const parser = new ImportParser(config);
        const result = parser.parse(code);
        const formatted = await formatImports(code, config, result);

        expect(formatted.text).toContain('// This is a code comment');
        expect(formatted.text).toContain('// This is a code comment\nconst Component');
    });

    it('should handle multiple orphaned group comments', async () => {
        const code = `import { foo } from 'bar';

// Group A

// Group B

const x = 1;`;

        const parser = new ImportParser(config);
        const result = parser.parse(code);
        const formatted = await formatImports(code, config, result);

        // Both orphaned comments should be removed
        expect(formatted.text).not.toContain('// Group A');
        expect(formatted.text).not.toContain('// Group B');
    });
});
