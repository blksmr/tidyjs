import * as path from 'path';
import { checkFiles } from '../src/commands/check';

const fixturesDir = path.join(__dirname, 'fixtures');

describe('check command', () => {
    it('passes for a sorted file', async () => {
        const results = await checkFiles(
            [path.join(fixturesDir, 'sorted.ts')],
            { rootDir: fixturesDir },
        );
        expect(results).toHaveLength(1);
        expect(results[0].passed).toBe(true);
    });

    it('fails for an unsorted file', async () => {
        const results = await checkFiles(
            [path.join(fixturesDir, 'unsorted.ts')],
            { rootDir: fixturesDir },
        );
        expect(results).toHaveLength(1);
        expect(results[0].passed).toBe(false);
        expect(results[0].issues).toContain('imports not sorted');
    });
});
