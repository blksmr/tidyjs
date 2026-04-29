import { getMinimalTextReplacement } from '../../src/utils/text-edit';

describe('getMinimalTextReplacement', () => {
    it('returns null when texts are identical', () => {
        expect(getMinimalTextReplacement('abc', 'abc')).toBeNull();
    });

    it('returns a narrow replacement for local changes', () => {
        const originalText = 'import a from \'a\';\nconst x = 1;\n';
        const updatedText = 'import b from \'b\';\nconst x = 1;\n';
        const replacement = getMinimalTextReplacement(
            originalText,
            updatedText
        );

        expect(replacement).toEqual(
            expect.objectContaining({
                start: 7,
            })
        );
        expect(replacement).not.toBeNull();

        const applied = originalText.slice(0, replacement!.start)
            + replacement!.newText
            + originalText.slice(replacement!.end);

        expect(applied).toBe(updatedText);
        expect(replacement!.end - replacement!.start).toBeLessThan(originalText.length);
    });
});
