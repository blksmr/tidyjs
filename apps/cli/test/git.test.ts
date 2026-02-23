import { filterSupportedFiles } from '../src/git';

describe('filterSupportedFiles', () => {
    it('keeps .ts, .tsx, .js, .jsx files', () => {
        const files = ['src/a.ts', 'src/b.tsx', 'src/c.js', 'src/d.jsx', 'README.md', 'config.json'];
        expect(filterSupportedFiles(files)).toEqual(['src/a.ts', 'src/b.tsx', 'src/c.js', 'src/d.jsx']);
    });

    it('returns empty for no supported files', () => {
        expect(filterSupportedFiles(['a.md', 'b.json'])).toEqual([]);
    });
});
