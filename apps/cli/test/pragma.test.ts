import * as path from 'path';
import { checkFiles } from '../src/commands/check';
import { fixFiles } from '../src/commands/fix';

const fixturesDir = path.join(__dirname, 'fixtures');

describe('ignore pragma', () => {
    it('check skips files with tidyjs-ignore pragma', async () => {
        const results = await checkFiles(
            [path.join(fixturesDir, 'with-pragma.ts')],
            { rootDir: fixturesDir },
        );
        expect(results).toHaveLength(1);
        expect(results[0].passed).toBe(true);
        expect(results[0].issues).toHaveLength(0);
    });

    it('fix skips files with tidyjs-ignore pragma', async () => {
        const results = await fixFiles(
            [path.join(fixturesDir, 'with-pragma.ts')],
            { rootDir: fixturesDir },
        );
        expect(results).toHaveLength(1);
        expect(results[0].passed).toBe(true);
        expect(results[0].issues).toHaveLength(0);
    });
});
