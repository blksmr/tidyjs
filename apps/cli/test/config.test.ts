import * as path from 'path';
import * as fs from 'fs';
import { checkFiles } from '../src/commands/check';
import { fixFiles } from '../src/commands/fix';

const fixturesDir = path.join(__dirname, 'fixtures');

describe('custom config', () => {
    it('--config option loads config from specified path', async () => {
        const configPath = path.join(fixturesDir, 'config-with-enum', '.tidyjsrc');

        // unsorted-enum.ts has sorted imports but unsorted enum members
        // With sortEnumMembers: true from the custom config, it should be flagged
        const results = await checkFiles(
            [path.join(fixturesDir, 'unsorted-enum.ts')],
            { configPath },
        );
        expect(results).toHaveLength(1);
        expect(results[0].passed).toBe(false);
        expect(results[0].issues).toContain('code patterns unsorted');
    });

    it('without sortEnumMembers config, enum is not flagged', async () => {
        // Using default fixtures config (no sortEnumMembers)
        const results = await checkFiles(
            [path.join(fixturesDir, 'unsorted-enum.ts')],
            { rootDir: fixturesDir },
        );
        expect(results).toHaveLength(1);
        // Default config has sortEnumMembers: false, so enum should not be flagged
        expect(results[0].issues).not.toContain('code patterns unsorted');
    });

    it('fix applies code patterns with custom config', async () => {
        const configPath = path.join(fixturesDir, 'config-with-enum', '.tidyjsrc');
        const tmpFile = path.join(__dirname, 'tmp-config-fix.ts');
        fs.copyFileSync(path.join(fixturesDir, 'unsorted-enum.ts'), tmpFile);

        try {
            const results = await fixFiles([tmpFile], { configPath });
            expect(results[0].passed).toBe(false);
            expect(results[0].issues).toContain('code patterns fixed');

            // After fix, check should pass
            const checkResults = await checkFiles([tmpFile], { configPath });
            expect(checkResults[0].passed).toBe(true);
        } finally {
            try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
        }
    });
});
