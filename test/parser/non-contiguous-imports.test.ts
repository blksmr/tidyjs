import { parseImports } from '../../src/parser';
import { formatImports } from '../../src/formatter';
import { Config } from '../../src/types';

const config: Config = {
    groups: [
        { name: 'React', order: 1, match: /^react/ },
        { name: 'Other', order: 2, default: true },
    ],
    importOrder: { sideEffect: 0, default: 1, named: 2, typeOnly: 3 },
    format: { indent: 4, singleQuote: true, bracketSpacing: true },
};

describe('Non-contiguous imports (lazy / interleaved code)', () => {
    test('does not throw on lazy dynamic imports followed by a static import', async () => {
        const source = `import React from 'react';
import { createRoot } from 'react-dom/client';
import { lazy } from 'react';

const App = lazy(() => import('./App'));
const Settings = lazy(() => import('./Settings'));

import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
`;

        const result = parseImports(source, config, 'index.tsx');
        const output = await formatImports(source, config, result);

        expect(output.error).toBeUndefined();
        expect(output.text).toContain("const App = lazy(() => import('./App'));");
        expect(output.text).toContain("const Settings = lazy(() => import('./Settings'));");
        expect(output.text).toContain("import './index.css';");
    });

    test('preserves executable code interleaved between import statements', async () => {
        const source = `import React from 'react';
import { createRoot } from 'react-dom/client';

const CONSTANT = computeSomething();
const SETTINGS = { a: 1 };

import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
`;

        const result = parseImports(source, config, 'index.tsx');
        const output = await formatImports(source, config, result);

        expect(output.error).toBeUndefined();
        expect(output.text).toContain('const CONSTANT = computeSomething();');
        expect(output.text).toContain('const SETTINGS = { a: 1 };');
        expect(output.text).toContain("import './index.css';");
    });

    test('still formats the leading contiguous import block', async () => {
        const source = `import { createRoot } from 'react-dom/client';
import React from 'react';

const App = () => null;

import './index.css';
`;

        const result = parseImports(source, config, 'index.tsx');
        const output = await formatImports(source, config, result);

        expect(output.error).toBeUndefined();
        const reactIndex = output.text.indexOf("from 'react'");
        const domIndex = output.text.indexOf("from 'react-dom/client'");
        expect(reactIndex).toBeGreaterThanOrEqual(0);
        expect(domIndex).toBeGreaterThanOrEqual(0);
        expect(reactIndex).toBeLessThan(domIndex);
    });
});
