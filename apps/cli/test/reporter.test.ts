import { reportResults } from '../src/reporter';
import type { FileResult } from '../src/reporter';

describe('reportResults', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
        process.env.NO_COLOR = '1'; // Disable colors in tests
        consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        consoleSpy.mockRestore();
        delete process.env.NO_COLOR;
    });

    function getOutput(): string {
        return consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
    }

    it('reports all files passing in check mode', () => {
        const results: FileResult[] = [
            { filePath: 'a.ts', issues: [], passed: true },
            { filePath: 'b.ts', issues: [], passed: true },
        ];
        reportResults(results, false, 'check');
        const output = getOutput();
        expect(output).toContain('All 2 files properly formatted');
    });

    it('reports single passing file with singular noun', () => {
        const results: FileResult[] = [
            { filePath: 'a.ts', issues: [], passed: true },
        ];
        reportResults(results, false, 'check');
        const output = getOutput();
        expect(output).toContain('All 1 file properly formatted');
        expect(output).not.toContain('files');
    });

    it('reports failing files in check mode', () => {
        const results: FileResult[] = [
            { filePath: 'a.ts', issues: ['imports not sorted'], passed: false },
        ];
        reportResults(results, false, 'check');
        const output = getOutput();
        expect(output).toContain('FAIL');
        expect(output).toContain('imports not sorted');
        expect(output).toContain('need formatting');
    });

    it('reports fixed files in fix mode', () => {
        const results: FileResult[] = [
            { filePath: 'a.ts', issues: ['imports fixed'], passed: false },
        ];
        reportResults(results, false, 'fix');
        const output = getOutput();
        expect(output).toContain('FIXED');
        expect(output).toContain('imports fixed');
        expect(output).toContain('fixed');
    });

    it('reports multiple issues per file', () => {
        const results: FileResult[] = [
            { filePath: 'a.ts', issues: ['imports not sorted', 'code patterns unsorted'], passed: false },
        ];
        reportResults(results, false, 'check');
        const output = getOutput();
        expect(output).toContain('imports not sorted, code patterns unsorted');
    });

    it('quiet mode suppresses per-file output', () => {
        const results: FileResult[] = [
            { filePath: 'a.ts', issues: [], passed: true },
            { filePath: 'b.ts', issues: [], passed: true },
        ];
        reportResults(results, true, 'check');
        const output = getOutput();
        // Should not have per-file lines
        expect(output).not.toContain('ok');
        expect(output).not.toContain('a.ts');
        // Should still have summary
        expect(output).toContain('properly formatted');
    });

    it('quiet mode still shows summary for failures', () => {
        const results: FileResult[] = [
            { filePath: 'a.ts', issues: ['imports not sorted'], passed: false },
        ];
        reportResults(results, true, 'check');
        const output = getOutput();
        // Per-file lines suppressed
        expect(output).not.toContain('FAIL');
        expect(output).not.toContain('a.ts');
        // Summary shown
        expect(output).toContain('need formatting');
    });

    it('shows ok prefix for passing files in verbose mode', () => {
        const results: FileResult[] = [
            { filePath: 'some/path.ts', issues: [], passed: true },
        ];
        reportResults(results, false, 'check');
        const output = getOutput();
        expect(output).toContain('ok some/path.ts');
    });

    it('mixed results show correct summary count', () => {
        const results: FileResult[] = [
            { filePath: 'a.ts', issues: [], passed: true },
            { filePath: 'b.ts', issues: ['imports not sorted'], passed: false },
            { filePath: 'c.ts', issues: ['code patterns unsorted'], passed: false },
        ];
        reportResults(results, false, 'check');
        const output = getOutput();
        expect(output).toContain('2 files need formatting');
    });
});
