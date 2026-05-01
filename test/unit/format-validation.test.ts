import { ImportParser } from '../../src/parser';
import type { Config } from '../../src/types';
import { validateFormattedOutput } from '../../src/utils/format-validation';

const config: Config = {
    groups: [{ name: 'Other', order: 0, default: true }],
    importOrder: { sideEffect: 0, default: 1, named: 2, typeOnly: 3 },
};

describe('validateFormattedOutput', () => {
    it('returns undefined for valid code', () => {
        const parser = new ImportParser(config);

        expect(validateFormattedOutput(parser, "import { a } from 'x';\n", 'file.ts')).toBeUndefined();
    });

    it('returns an error for invalid code', () => {
        const parser = new ImportParser(config);
        const error = validateFormattedOutput(parser, "import {\n    a,\nimport { b } from 'x';\n", 'file.ts');

        expect(error).toContain('Syntax error during parsing');
    });
});
