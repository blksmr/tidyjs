import * as path from 'path';
import * as fs from 'fs';
import { fixFiles } from '../src/commands/fix';
import { checkFiles } from '../src/commands/check';

const fixturesDir = path.join(__dirname, 'fixtures');
const configPath = path.join(fixturesDir, '.tidyjsrc');

describe('fix command', () => {
    const tmpFiles: string[] = [];

    afterEach(() => {
        for (const f of tmpFiles) {
            try { fs.unlinkSync(f); } catch { /* ignore */ }
        }
        tmpFiles.length = 0;
    });

    function createTmpCopy(fixture: string, tmpName: string): string {
        const tmpFile = path.join(fixturesDir, tmpName);
        fs.copyFileSync(path.join(fixturesDir, fixture), tmpFile);
        tmpFiles.push(tmpFile);
        return tmpFile;
    }

    it('fixes an unsorted file', async () => {
        const tmpFile = createTmpCopy('unsorted.ts', 'tmp-fix-test.ts');

        const results = await fixFiles([tmpFile], { configPath });
        expect(results).toHaveLength(1);
        expect(results[0].passed).toBe(false); // passed=false means changes were made
        expect(results[0].issues).toContain('imports fixed');

        // Verify file was actually rewritten
        const content = fs.readFileSync(tmpFile, 'utf8');
        expect(content).toContain("from 'react'");
        // Verify import lines are in the correct order
        const lines = content.split('\n').filter(l => l.startsWith('import'));
        // React (group 0) should come first, then External (lodash, group 1), then Relative (./utils, group 2)
        expect(lines.findIndex(l => l.includes('react'))).toBeLessThan(
            lines.findIndex(l => l.includes('lodash')),
        );
        expect(lines.findIndex(l => l.includes('lodash'))).toBeLessThan(
            lines.findIndex(l => l.includes('./utils')),
        );
    });

    it('fix then check is idempotent', async () => {
        const tmpFile = createTmpCopy('unsorted.ts', 'tmp-idempotent.ts');

        // Fix
        await fixFiles([tmpFile], { configPath });

        // Check should pass now
        const results = await checkFiles([tmpFile], { configPath });
        expect(results[0].passed).toBe(true);
    });

    it('does not modify an already sorted file', async () => {
        const tmpFile = createTmpCopy('sorted.ts', 'tmp-sorted.ts');
        const originalContent = fs.readFileSync(tmpFile, 'utf8');

        const results = await fixFiles([tmpFile], { configPath });
        expect(results[0].passed).toBe(true);
        expect(results[0].issues).toHaveLength(0);

        // File content should be unchanged
        const afterContent = fs.readFileSync(tmpFile, 'utf8');
        expect(afterContent).toBe(originalContent);
    });

    it('fixes multiple files in one call', async () => {
        const tmpFile1 = createTmpCopy('unsorted.ts', 'tmp-multi-1.ts');
        const tmpFile2 = createTmpCopy('unsorted.ts', 'tmp-multi-2.ts');

        const results = await fixFiles([tmpFile1, tmpFile2], { configPath });
        expect(results).toHaveLength(2);
        expect(results[0].passed).toBe(false);
        expect(results[1].passed).toBe(false);
        expect(results[0].issues).toContain('imports fixed');
        expect(results[1].issues).toContain('imports fixed');
    });

    it('skips files with tidyjs-ignore pragma', async () => {
        const tmpFile = createTmpCopy('with-pragma.ts', 'tmp-pragma-fix.ts');
        const originalContent = fs.readFileSync(tmpFile, 'utf8');

        const results = await fixFiles([tmpFile], { configPath });
        expect(results[0].passed).toBe(true);
        expect(results[0].issues).toHaveLength(0);

        // Content should be unchanged
        const afterContent = fs.readFileSync(tmpFile, 'utf8');
        expect(afterContent).toBe(originalContent);
    });
});
