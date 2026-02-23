import * as path from 'path';
import { checkFiles } from '../src/commands/check';
import { fixFiles } from '../src/commands/fix';

describe('error handling', () => {
    it('checkFiles throws for non-existent file', async () => {
        await expect(
            checkFiles(['/tmp/does-not-exist-tidyjs-12345.ts'], {}),
        ).rejects.toThrow();
    });

    it('fixFiles throws for non-existent file', async () => {
        await expect(
            fixFiles(['/tmp/does-not-exist-tidyjs-12345.ts'], {}),
        ).rejects.toThrow();
    });

    it('checkFiles handles multiple files where one does not exist', async () => {
        const fixturesDir = path.join(__dirname, 'fixtures');
        const goodFile = path.join(fixturesDir, 'sorted.ts');

        // The first file succeeds but the second throws
        await expect(
            checkFiles([goodFile, '/tmp/does-not-exist-tidyjs-12345.ts'], { rootDir: fixturesDir }),
        ).rejects.toThrow();
    });
});
