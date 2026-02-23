import {
    discoverFiles,
    isFileInExcludedFolder,
    formatSingleFile,
} from '../../src/batch-formatter';
import type { Config } from '@tidyjs/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

jest.mock('../../src/utils/log', () => ({
    logDebug: jest.fn(),
    logError: jest.fn(),
    logInfo: jest.fn()
}));

// Mock vscode (needed by configLoader which is imported by batch-formatter)
jest.mock('vscode');

describe('Batch Formatter - Edge Cases', () => {

    describe('isFileInExcludedFolder', () => {
        const baseConfig: Config = {
            groups: [],
            importOrder: { default: 0, named: 1, typeOnly: 2, sideEffect: 3 },
            excludedFolders: ['dist', 'build', 'generated/api'],
        };

        it('should exclude files in listed folders', () => {
            expect(isFileInExcludedFolder('/project/dist/bundle.js', baseConfig, '/project')).toBe(true);
            expect(isFileInExcludedFolder('/project/build/output.ts', baseConfig, '/project')).toBe(true);
        });

        it('should exclude files in nested excluded folders', () => {
            expect(isFileInExcludedFolder('/project/generated/api/client.ts', baseConfig, '/project')).toBe(true);
        });

        it('should NOT exclude files in folders that merely start with the excluded name', () => {
            // 'dist-legacy' starts with 'dist' but is not 'dist'
            expect(isFileInExcludedFolder('/project/dist-legacy/file.ts', baseConfig, '/project')).toBe(false);
            expect(isFileInExcludedFolder('/project/builder/file.ts', baseConfig, '/project')).toBe(false);
        });

        it('should return false when excludedFolders is empty', () => {
            const config: Config = {
                ...baseConfig,
                excludedFolders: [],
            };
            expect(isFileInExcludedFolder('/project/dist/file.ts', config, '/project')).toBe(false);
        });

        it('should return false when excludedFolders is undefined', () => {
            const config: Config = {
                ...baseConfig,
                excludedFolders: undefined,
            };
            expect(isFileInExcludedFolder('/project/dist/file.ts', config, '/project')).toBe(false);
        });

        it('should return false when workspaceRoot is undefined', () => {
            expect(isFileInExcludedFolder('/project/dist/file.ts', baseConfig, undefined)).toBe(false);
        });

        it('should handle Windows-style backslash paths', () => {
            // path.relative on Windows produces backslashes; the function normalizes to forward slashes
            const config: Config = {
                ...baseConfig,
                excludedFolders: ['dist'],
            };
            // On Unix, path.relative won't produce backslashes, but the logic should handle both
            expect(isFileInExcludedFolder('/project/dist/file.ts', config, '/project')).toBe(true);
        });

        it('should handle exact folder match (file at root of excluded folder)', () => {
            const config: Config = {
                ...baseConfig,
                excludedFolders: ['dist'],
            };
            // The path IS the excluded folder, not a file inside it
            // relativePath = 'dist' which equals excludedFolder 'dist'
            expect(isFileInExcludedFolder('/project/dist', config, '/project')).toBe(true);
        });
    });

    describe('discoverFiles', () => {
        let tmpDir: string;

        beforeEach(() => {
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tidyjs-test-'));
        });

        afterEach(() => {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        });

        it('should discover .ts, .tsx, .js, .jsx files', async () => {
            fs.writeFileSync(path.join(tmpDir, 'a.ts'), '');
            fs.writeFileSync(path.join(tmpDir, 'b.tsx'), '');
            fs.writeFileSync(path.join(tmpDir, 'c.js'), '');
            fs.writeFileSync(path.join(tmpDir, 'd.jsx'), '');
            fs.writeFileSync(path.join(tmpDir, 'e.json'), '');
            fs.writeFileSync(path.join(tmpDir, 'f.css'), '');

            const files = await discoverFiles(tmpDir);
            expect(files).toHaveLength(4);
            expect(files.map(f => path.basename(f)).sort()).toEqual(['a.ts', 'b.tsx', 'c.js', 'd.jsx']);
        });

        it('should skip node_modules, .git, dist, build, out directories', async () => {
            const skipDirs = ['node_modules', '.git', 'dist', 'build', 'out'];
            for (const dir of skipDirs) {
                const dirPath = path.join(tmpDir, dir);
                fs.mkdirSync(dirPath, { recursive: true });
                fs.writeFileSync(path.join(dirPath, 'file.ts'), '');
            }
            // Also add a normal file
            fs.writeFileSync(path.join(tmpDir, 'normal.ts'), '');

            const files = await discoverFiles(tmpDir);
            expect(files).toHaveLength(1);
            expect(path.basename(files[0])).toBe('normal.ts');
        });

        it('should discover files in subdirectories', async () => {
            const subDir = path.join(tmpDir, 'src', 'components');
            fs.mkdirSync(subDir, { recursive: true });
            fs.writeFileSync(path.join(subDir, 'Button.tsx'), '');
            fs.writeFileSync(path.join(tmpDir, 'index.ts'), '');

            const files = await discoverFiles(tmpDir);
            expect(files).toHaveLength(2);
        });

        it('should return empty array for empty directory', async () => {
            const files = await discoverFiles(tmpDir);
            expect(files).toEqual([]);
        });

        it('should return empty array for non-existent directory', async () => {
            const files = await discoverFiles(path.join(tmpDir, 'non-existent'));
            expect(files).toEqual([]);
        });

        it('should handle symlink loops without infinite recursion', async () => {
            const dirA = path.join(tmpDir, 'a');
            const dirB = path.join(tmpDir, 'b');
            fs.mkdirSync(dirA);
            fs.mkdirSync(dirB);
            fs.writeFileSync(path.join(dirA, 'file.ts'), '');

            // Create symlink loop: a/link -> b, b/link -> a
            fs.symlinkSync(dirB, path.join(dirA, 'link'), 'dir');
            fs.symlinkSync(dirA, path.join(dirB, 'link'), 'dir');

            // Should not hang or throw
            const files = await discoverFiles(tmpDir);
            expect(files.length).toBeGreaterThanOrEqual(1);
        });

        it('should skip .next, coverage, .cache, .turbo directories', async () => {
            const skipDirs = ['.next', 'coverage', '.cache', '.turbo'];
            for (const dir of skipDirs) {
                const dirPath = path.join(tmpDir, dir);
                fs.mkdirSync(dirPath, { recursive: true });
                fs.writeFileSync(path.join(dirPath, 'file.ts'), '');
            }

            const files = await discoverFiles(tmpDir);
            expect(files).toEqual([]);
        });
    });

    describe('formatSingleFile', () => {
        let tmpDir: string;

        beforeEach(() => {
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tidyjs-fmt-'));
        });

        afterEach(() => {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        });

        const minConfig: Config = {
            groups: [{ name: 'External', order: 0, match: /^[^.]/ }],
            importOrder: { default: 0, named: 1, typeOnly: 2, sideEffect: 3 },
            format: { indent: 4, singleQuote: true },
        };

        it('should skip empty files', async () => {
            const filePath = path.join(tmpDir, 'empty.ts');
            fs.writeFileSync(filePath, '   \n\n  ');

            const result = await formatSingleFile(filePath, minConfig, new Map());
            expect(result.changed).toBe(false);
            expect(result.skipReason).toBe('empty');
        });

        it('should skip files with tidyjs-ignore pragma', async () => {
            const filePath = path.join(tmpDir, 'ignored.ts');
            fs.writeFileSync(filePath, '// tidyjs-ignore\nimport { foo } from "bar";\n');

            const result = await formatSingleFile(filePath, minConfig, new Map());
            expect(result.changed).toBe(false);
            expect(result.skipReason).toBe('ignored');
        });

        it('should skip files with no imports', async () => {
            const filePath = path.join(tmpDir, 'no-imports.ts');
            fs.writeFileSync(filePath, 'const x = 1;\nexport default x;\n');

            const result = await formatSingleFile(filePath, minConfig, new Map());
            expect(result.changed).toBe(false);
            expect(result.skipReason).toBe('no-imports');
        });

        it('should return error for non-existent file', async () => {
            const filePath = path.join(tmpDir, 'does-not-exist.ts');

            const result = await formatSingleFile(filePath, minConfig, new Map());
            expect(result.changed).toBe(false);
            expect(result.error).toMatch(/Failed to read file/);
        });

        it('should reuse cached parser for same config', async () => {
            const filePath = path.join(tmpDir, 'file.ts');
            fs.writeFileSync(filePath, 'const x = 1;\n');

            const cache = new Map();
            await formatSingleFile(filePath, minConfig, cache);
            expect(cache.size).toBe(1);

            // Second call with same config should reuse
            fs.writeFileSync(filePath, 'const y = 2;\n');
            await formatSingleFile(filePath, minConfig, cache);
            expect(cache.size).toBe(1);
        });

        it('should create new parser for different config', async () => {
            const filePath = path.join(tmpDir, 'file.ts');
            fs.writeFileSync(filePath, 'const x = 1;\n');

            const cache = new Map();
            await formatSingleFile(filePath, minConfig, cache);

            const otherConfig: Config = {
                ...minConfig,
                format: { indent: 2 },
            };
            fs.writeFileSync(filePath, 'const y = 2;\n');
            await formatSingleFile(filePath, otherConfig, cache);
            expect(cache.size).toBe(2);
        });

        it('should handle tidyjs-ignore with leading whitespace', async () => {
            const filePath = path.join(tmpDir, 'ignored2.ts');
            fs.writeFileSync(filePath, '  // tidyjs-ignore  \nimport { foo } from "bar";\n');

            const result = await formatSingleFile(filePath, minConfig, new Map());
            expect(result.changed).toBe(false);
            expect(result.skipReason).toBe('ignored');
        });

        it('should NOT treat inline tidyjs-ignore as file-level ignore', async () => {
            const filePath = path.join(tmpDir, 'not-ignored.ts');
            // Comment is not on its own line (has code before it)
            fs.writeFileSync(filePath, 'const x = 1; // tidyjs-ignore\nimport { foo } from "bar";\n');

            const result = await formatSingleFile(filePath, minConfig, new Map());
            // Should NOT be skipped because the pragma is not on its own line
            // The regex uses ^...$ with /m flag, so "const x = 1; // tidyjs-ignore" should NOT match
            // because "const x = 1; " is before the comment
            expect(result.skipReason).not.toBe('ignored');
        });
    });
});
