import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
    discoverFiles,
    isFileInExcludedFolder,
    formatSingleFile,
} from '../../src/batch-formatter';

import type { Config } from '@tidyjs/core';

// --- Helpers ---

function makeTempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'tidyjs-batch-test-'));
}

function writeFile(dir: string, relativePath: string, content: string): string {
    const fullPath = path.join(dir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
    return fullPath;
}

function cleanup(dir: string): void {
    fs.rmSync(dir, { recursive: true, force: true });
}

const BASE_CONFIG: Config = {
    groups: [{ name: 'Other', order: 0, default: true }],
    importOrder: { default: 0, named: 1, typeOnly: 2, sideEffect: 3 },
    format: { indent: 4, singleQuote: true, bracketSpacing: true },
    excludedFolders: [],
};

// --- Tests ---

describe('discoverFiles', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = makeTempDir();
    });

    afterEach(() => {
        cleanup(tmpDir);
    });

    test('finds .ts, .tsx, .js, .jsx files', async () => {
        writeFile(tmpDir, 'a.ts', '');
        writeFile(tmpDir, 'b.tsx', '');
        writeFile(tmpDir, 'c.js', '');
        writeFile(tmpDir, 'd.jsx', '');
        writeFile(tmpDir, 'e.css', '');
        writeFile(tmpDir, 'f.json', '');

        const files = await discoverFiles(tmpDir);
        const names = files.map(f => path.basename(f)).sort();

        expect(names).toEqual(['a.ts', 'b.tsx', 'c.js', 'd.jsx']);
    });

    test('recurses into subdirectories', async () => {
        writeFile(tmpDir, 'src/components/Button.tsx', '');
        writeFile(tmpDir, 'src/utils/helper.ts', '');

        const files = await discoverFiles(tmpDir);
        expect(files).toHaveLength(2);
    });

    test('skips node_modules and other excluded directories', async () => {
        writeFile(tmpDir, 'node_modules/pkg/index.ts', '');
        writeFile(tmpDir, '.git/hooks/pre-commit.js', '');
        writeFile(tmpDir, 'dist/bundle.js', '');
        writeFile(tmpDir, 'build/output.js', '');
        writeFile(tmpDir, '.next/server.js', '');
        writeFile(tmpDir, 'coverage/lcov.js', '');
        writeFile(tmpDir, '.cache/cached.js', '');
        writeFile(tmpDir, '.turbo/run.js', '');
        writeFile(tmpDir, 'out/compiled.js', '');
        writeFile(tmpDir, 'src/app.ts', '');

        const files = await discoverFiles(tmpDir);
        const names = files.map(f => path.basename(f));

        expect(names).toEqual(['app.ts']);
    });

    test('returns empty array for non-existent directory', async () => {
        const files = await discoverFiles(path.join(tmpDir, 'nonexistent'));
        expect(files).toEqual([]);
    });
});

describe('isFileInExcludedFolder', () => {
    test('returns false when no excluded folders', () => {
        const config: Config = { ...BASE_CONFIG, excludedFolders: [] };
        expect(isFileInExcludedFolder('/workspace/src/app.ts', config, '/workspace')).toBe(false);
    });

    test('returns false when no workspace root', () => {
        const config: Config = { ...BASE_CONFIG, excludedFolders: ['generated'] };
        expect(isFileInExcludedFolder('/workspace/generated/app.ts', config, undefined)).toBe(false);
    });

    test('detects file in excluded folder', () => {
        const config: Config = { ...BASE_CONFIG, excludedFolders: ['generated'] };
        expect(isFileInExcludedFolder('/workspace/generated/app.ts', config, '/workspace')).toBe(true);
    });

    test('detects file in nested excluded folder', () => {
        const config: Config = { ...BASE_CONFIG, excludedFolders: ['src/generated'] };
        expect(isFileInExcludedFolder('/workspace/src/generated/types.ts', config, '/workspace')).toBe(true);
    });

    test('does not exclude file outside excluded folder', () => {
        const config: Config = { ...BASE_CONFIG, excludedFolders: ['generated'] };
        expect(isFileInExcludedFolder('/workspace/src/app.ts', config, '/workspace')).toBe(false);
    });

    test('handles backslash normalization', () => {
        const config: Config = { ...BASE_CONFIG, excludedFolders: ['src\\generated'] };
        expect(isFileInExcludedFolder('/workspace/src/generated/types.ts', config, '/workspace')).toBe(true);
    });
});

describe('formatSingleFile', () => {
    let tmpDir: string;
    let parserCache: Map<string, any>;

    beforeEach(() => {
        tmpDir = makeTempDir();
        parserCache = new Map();
    });

    afterEach(() => {
        // Dispose parsers
        for (const parser of parserCache.values()) {
            parser.dispose();
        }
        cleanup(tmpDir);
    });

    test('formats a file with unorganized imports', async () => {
        const filePath = writeFile(tmpDir, 'app.ts', [
            "import { z } from 'zod';",
            "import { a } from 'alpha';",
            '',
            'const x = 1;',
        ].join('\n'));

        const result = await formatSingleFile(filePath, BASE_CONFIG, parserCache);

        expect(result.changed).toBe(true);
        expect(result.error).toBeUndefined();

        // Verify file was actually written
        const content = fs.readFileSync(filePath, 'utf8');
        expect(content).toContain("from 'alpha'");
        expect(content).toContain("from 'zod'");
    });

    test('returns changed=false for already-formatted file', async () => {
        // First format a file to get the canonical output
        const setupPath = writeFile(tmpDir, 'setup.ts', [
            "import { z } from 'zod';",
            "import { a } from 'alpha';",
            '',
            'const x = 1;',
        ].join('\n'));
        await formatSingleFile(setupPath, BASE_CONFIG, parserCache);
        const canonicalContent = fs.readFileSync(setupPath, 'utf8');

        // Write the canonical content to a new file
        const filePath = writeFile(tmpDir, 'sorted.ts', canonicalContent);

        const result = await formatSingleFile(filePath, BASE_CONFIG, parserCache);
        expect(result.changed).toBe(false);
        expect(result.error).toBeUndefined();
    });

    test('skips empty files with reason "empty"', async () => {
        const filePath = writeFile(tmpDir, 'empty.ts', '');

        const result = await formatSingleFile(filePath, BASE_CONFIG, parserCache);
        expect(result.changed).toBe(false);
        expect(result.skipReason).toBe('empty');
        expect(result.error).toBeUndefined();
    });

    test('skips files with tidyjs-ignore pragma with reason "ignored"', async () => {
        const filePath = writeFile(tmpDir, 'ignored.ts', [
            '// tidyjs-ignore',
            "import { z } from 'zod';",
            "import { a } from 'alpha';",
        ].join('\n'));

        const result = await formatSingleFile(filePath, BASE_CONFIG, parserCache);
        expect(result.changed).toBe(false);
        expect(result.skipReason).toBe('ignored');
        expect(result.error).toBeUndefined();
    });

    test('skips files with no imports with reason "no-imports"', async () => {
        const filePath = writeFile(tmpDir, 'noImports.ts', [
            'const x = 1;',
            'export default x;',
        ].join('\n'));

        const result = await formatSingleFile(filePath, BASE_CONFIG, parserCache);
        expect(result.changed).toBe(false);
        expect(result.skipReason).toBe('no-imports');
        expect(result.error).toBeUndefined();
    });

    test('idempotence: formatting twice produces the same result', async () => {
        const filePath = writeFile(tmpDir, 'idem.ts', [
            "import { z } from 'zod';",
            "import { a } from 'alpha';",
            '',
            'const x = 1;',
        ].join('\n'));

        // First format
        const result1 = await formatSingleFile(filePath, BASE_CONFIG, parserCache);
        expect(result1.changed).toBe(true);
        const contentAfterFirst = fs.readFileSync(filePath, 'utf8');

        // Second format
        const result2 = await formatSingleFile(filePath, BASE_CONFIG, parserCache);
        expect(result2.changed).toBe(false);
        expect(result2.skipReason).toBe('unchanged');
        const contentAfterSecond = fs.readFileSync(filePath, 'utf8');

        expect(contentAfterFirst).toBe(contentAfterSecond);
    });

    test('converts relative imports to aliases when pathResolution is enabled (absolute mode)', async () => {
        // Create a project structure with tsconfig paths
        writeFile(tmpDir, 'tsconfig.json', JSON.stringify({
            compilerOptions: {
                baseUrl: '.',
                paths: {
                    '@/*': ['src/*']
                }
            }
        }));

        // Create the target file that the import points to
        writeFile(tmpDir, 'src/utils/helper.ts', 'export const helper = 1;\n');

        // Create a source file with a relative import that should become @/utils/helper
        const filePath = writeFile(tmpDir, 'src/components/Button.ts', [
            "import { helper } from '../utils/helper';",
            '',
            'const x = helper;',
        ].join('\n'));

        const config: Config = {
            ...BASE_CONFIG,
            pathResolution: {
                mode: 'absolute',
            },
        };

        const result = await formatSingleFile(filePath, config, parserCache, tmpDir);

        expect(result.changed).toBe(true);
        expect(result.error).toBeUndefined();

        const content = fs.readFileSync(filePath, 'utf8');
        expect(content).toContain('@/utils/helper');
        expect(content).not.toContain('../utils/helper');
    });

    test('converts alias imports to relative when pathResolution is enabled (relative mode)', async () => {
        // Create a project structure with tsconfig paths
        writeFile(tmpDir, 'tsconfig.json', JSON.stringify({
            compilerOptions: {
                baseUrl: '.',
                paths: {
                    '@/*': ['src/*']
                }
            }
        }));

        // Create the target file
        writeFile(tmpDir, 'src/utils/helper.ts', 'export const helper = 1;\n');

        // Create a source file with an alias import
        const filePath = writeFile(tmpDir, 'src/components/Button.ts', [
            "import { helper } from '@/utils/helper';",
            '',
            'const x = helper;',
        ].join('\n'));

        const config: Config = {
            ...BASE_CONFIG,
            pathResolution: {
                mode: 'relative',
            },
        };

        const result = await formatSingleFile(filePath, config, parserCache, tmpDir);

        expect(result.changed).toBe(true);
        expect(result.error).toBeUndefined();

        const content = fs.readFileSync(filePath, 'utf8');
        expect(content).toContain('../utils/helper');
        expect(content).not.toContain('@/utils/helper');
    });

    test('skips path resolution when workspaceRoot is not provided', async () => {
        writeFile(tmpDir, 'tsconfig.json', JSON.stringify({
            compilerOptions: {
                baseUrl: '.',
                paths: { '@/*': ['src/*'] }
            }
        }));
        writeFile(tmpDir, 'src/utils/helper.ts', 'export const helper = 1;\n');

        const filePath = writeFile(tmpDir, 'src/components/Button.ts', [
            "import { helper } from '../utils/helper';",
            '',
            'const x = helper;',
        ].join('\n'));

        const config: Config = {
            ...BASE_CONFIG,
            pathResolution: {
                mode: 'absolute',
            },
        };

        // No workspaceRoot → path resolution should be skipped
        const result = await formatSingleFile(filePath, config, parserCache);

        // The file may or may not change due to import formatting,
        // but the relative path should remain unchanged
        const content = fs.readFileSync(filePath, 'utf8');
        expect(content).toContain('../utils/helper');
        expect(content).not.toContain('@/utils/helper');
    });

    test('skips path resolution when pathResolution.mode is false', async () => {
        writeFile(tmpDir, 'tsconfig.json', JSON.stringify({
            compilerOptions: {
                baseUrl: '.',
                paths: { '@/*': ['src/*'] }
            }
        }));
        writeFile(tmpDir, 'src/utils/helper.ts', 'export const helper = 1;\n');

        const filePath = writeFile(tmpDir, 'src/components/Button.ts', [
            "import { helper } from '../utils/helper';",
            '',
            'const x = helper;',
        ].join('\n'));

        const config: Config = {
            ...BASE_CONFIG,
            pathResolution: {
                mode: false,
            },
        };

        const result = await formatSingleFile(filePath, config, parserCache, tmpDir);

        const content = fs.readFileSync(filePath, 'utf8');
        expect(content).toContain('../utils/helper');
        expect(content).not.toContain('@/utils/helper');
    });
});
