import { sortDestructuring } from '../../src/destructuring-sorter';
import { parse } from '@typescript-eslint/parser';
import type { Config } from '../../src/types';

const config: Config = {
    groups: [],
    importOrder: {
        default: 0,
        named: 1,
        typeOnly: 2,
        sideEffect: 3,
    },
    format: {
        sortDestructuring: true,
    },
};

describe('sortDestructuring: object literals are never sorted', () => {
    it('should not sort multiline object literals (property order is semantic)', () => {
        const input = `\
class Foo {
    static values = (): Array<SomeType> => [
        { value: 1, code: 'shortCode', text: 'Short text' },
        { value: 6, code: 'longCodeThatMakesItMultiline',
            text: 'Long text that wraps to next line' },
    ];
}
`;
        expect(sortDestructuring(input, config)).toBe(input);
    });

    it('should not sort object literals in function calls', () => {
        const input = `\
const table = useTable({
    columns: getColumns,
    state: {
        rowSelection,
        columnVisibility: {
            'fpcCodeOption': !filters.flag,
            'cecTaux': filters.flag,
        }
    },
    onRowSelectionChange: handleSelection,
    data: tableData
});
`;
        const result = sortDestructuring(input, config);

        // Object literal untouched — no reordering
        expect(result).toBe(input);

        // Must still be valid TypeScript
        expect(() => {
            parse(result, { range: true, loc: true, jsx: true });
        }).not.toThrow();
    });

    it('should not sort object literals with spread (override semantics)', () => {
        const input = `\
const obj = {
    ...defaults,
    data: computed,
    isLoading: false,
};
`;
        expect(sortDestructuring(input, config)).toBe(input);
    });
});

describe('sortDestructuring: destructuring patterns are sorted correctly', () => {
    it('should sort multiline destructuring pattern', () => {
        const input = `\
const {
    telephone,
    id,
    nom,
} = person;
`;
        const result = sortDestructuring(input, config);

        const idIdx = result.indexOf('id');
        const nomIdx = result.indexOf('nom');
        const telIdx = result.indexOf('telephone');
        expect(idIdx).toBeLessThan(nomIdx);
        expect(nomIdx).toBeLessThan(telIdx);

        expect(() => {
            parse(result, { range: true, loc: true, jsx: true });
        }).not.toThrow();
    });

    it('should preserve rest element position in destructuring', () => {
        const input = `\
const {
    longName,
    a,
    ...rest
} = obj;
`;
        const result = sortDestructuring(input, config);

        // `a` should come before `longName`, `...rest` stays last
        const aIdx = result.indexOf('a,');
        const longIdx = result.indexOf('longName');
        const restIdx = result.indexOf('...rest');
        expect(aIdx).toBeLessThan(longIdx);
        expect(longIdx).toBeLessThan(restIdx);
    });

    it('should handle nested destructuring with correct indentation', () => {
        const input = `\
function test() {
    const {
            telephone,
            id,
            nom,
    } = getData();
}
`;
        const result = sortDestructuring(input, config);

        // Should preserve the 12-space indent (not fall back to 4)
        expect(result).toContain('            id');
        expect(result).toContain('            nom');
        expect(result).toContain('            telephone');
    });
});
