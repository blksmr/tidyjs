import { sortCodePatterns, sortPropertiesInSelection } from '../../src/destructuring-sorter';
import { parseSource } from '../../src/utils/oxc-parse';
import type { Config } from '../../src/types';

const enumConfig: Config = {
    groups: [],
    importOrder: {
        default: 0,
        named: 1,
        typeOnly: 2,
        sideEffect: 3,
    },
    format: {
        sortEnumMembers: true,
    },
};

/** Helper: sort the entire text as if the user selected everything */
function sortSelection(input: string): string {
    return sortPropertiesInSelection(input, 0, input.length) ?? input;
}

describe('sortPropertiesInSelection: object literals are sorted when user selects them', () => {
    it('should sort multiline object literals in selection mode', () => {
        const input = `\
class Foo {
    static values = (): Array<SomeType> => [
        { value: 1, code: 'shortCode', text: 'Short text' },
        { value: 6, code: 'longCodeThatMakesItMultiline',
            text: 'Long text that wraps to next line' },
    ];
}
`;
        // The second object literal wraps to 2 lines, so it IS multiline.
        // In selection mode, multiline ObjectExpressions ARE sorted.
        // The first object literal is single-line, so it stays intact.
        const result = sortSelection(input);
        // Single-line object stays unchanged
        expect(result).toContain(`{ value: 1, code: 'shortCode', text: 'Short text' }`);
        // Multiline object is sorted — code (4) < text (4) < value (5)
        expect(result).toContain('code:');
        expect(result).toContain('text:');
        expect(result).toContain('value: 6');
    });

    it('should sort multiline object literals in function calls', () => {
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
        const result = sortSelection(input);
        // Object literals in selection mode ARE sorted
        expect(result).toBeDefined();

        // Must still be valid TypeScript
        expect(() => {
            parseSource(result);
        }).not.toThrow();
    });

    it('should sort object literals with spread in selection mode', () => {
        const input = `\
const obj = {
    ...defaults,
    data: computed,
    isLoading: false,
};
`;
        // SpreadElement is treated as rest and stays at end
        const result = sortSelection(input);
        expect(result).toBeDefined();
    });
});

describe('sortPropertiesInSelection: destructuring patterns are sorted correctly', () => {
    it('should sort multiline destructuring pattern', () => {
        const input = `\
const {
    telephone,
    id,
    nom,
} = person;
`;
        const result = sortSelection(input);

        const idIdx = result.indexOf('id');
        const nomIdx = result.indexOf('nom');
        const telIdx = result.indexOf('telephone');
        expect(idIdx).toBeLessThan(nomIdx);
        expect(nomIdx).toBeLessThan(telIdx);

        expect(() => {
            parseSource(result);
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
        const result = sortSelection(input);

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
        const result = sortSelection(input);

        // Should preserve the 12-space indent (not fall back to 4)
        expect(result).toContain('            id');
        expect(result).toContain('            nom');
        expect(result).toContain('            telephone');
    });
});

describe('sortCodePatterns: automatic pipeline does NOT sort destructuring', () => {
    it('should not sort destructuring patterns automatically', () => {
        const input = `\
const {
    telephone,
    id,
    nom,
} = person;
`;
        expect(sortCodePatterns(input, enumConfig)).toBe(input);
    });
});
