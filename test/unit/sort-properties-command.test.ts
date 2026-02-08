import { sortPropertiesInSelection } from '../../src/destructuring-sorter';

/** Helper: sort the entire text as if the user selected everything */
function sortSelection(input: string): string {
    return sortPropertiesInSelection(input, 0, input.length) ?? input;
}

describe('sortPropertiesInSelection — command behavior', () => {
    describe('ObjectPattern in selection', () => {
        it('should sort destructured properties', () => {
            const input = `const {
    zebra,
    alpha,
    mango,
} = props;`;
            const result = sortSelection(input);
            const alphaIdx = result.indexOf('alpha');
            const mangoIdx = result.indexOf('mango');
            const zebraIdx = result.indexOf('zebra');
            expect(alphaIdx).toBeLessThan(mangoIdx);
            expect(mangoIdx).toBeLessThan(zebraIdx);
        });
    });

    describe('ObjectExpression in selection', () => {
        it('should sort object literal properties', () => {
            const input = `const obj = {
    zebra: 1,
    alpha: 2,
    mango: 3,
};`;
            const result = sortSelection(input);
            const alphaIdx = result.indexOf('alpha:');
            const mangoIdx = result.indexOf('mango:');
            const zebraIdx = result.indexOf('zebra:');
            expect(alphaIdx).toBeLessThan(mangoIdx);
            expect(mangoIdx).toBeLessThan(zebraIdx);
        });

        it('should sort object literal in return statement', () => {
            const input = `function foo() {
    return {
        telephone: '123',
        id: 1,
        nom: 'test',
    };
}`;
            const result = sortSelection(input);
            const idIdx = result.indexOf('id:');
            const nomIdx = result.indexOf('nom:');
            const telIdx = result.indexOf('telephone:');
            expect(idIdx).toBeLessThan(nomIdx);
            expect(nomIdx).toBeLessThan(telIdx);
        });
    });

    describe('interface in selection', () => {
        it('should sort interface properties', () => {
            const input = `interface User {
    telephone: string;
    id: number;
    nom: string;
}`;
            const result = sortSelection(input);
            const idIdx = result.indexOf('id:');
            const nomIdx = result.indexOf('nom:');
            const telIdx = result.indexOf('telephone:');
            expect(idIdx).toBeLessThan(nomIdx);
            expect(nomIdx).toBeLessThan(telIdx);
        });
    });

    describe('type literal in selection', () => {
        it('should sort type literal properties', () => {
            const input = `type User = {
    telephone: string;
    id: number;
    nom: string;
};`;
            const result = sortSelection(input);
            const idIdx = result.indexOf('id:');
            const nomIdx = result.indexOf('nom:');
            const telIdx = result.indexOf('telephone:');
            expect(idIdx).toBeLessThan(nomIdx);
            expect(nomIdx).toBeLessThan(telIdx);
        });
    });

    describe('partial selection (overlap)', () => {
        it('should sort pattern that overlaps selection', () => {
            const input = `const x = 1;
const {
    zebra,
    alpha,
} = props;
const y = 2;`;
            // Select just the destructuring part
            const start = input.indexOf('const {');
            const end = input.indexOf('} = props;') + '} = props;'.length;
            const result = sortPropertiesInSelection(input, start, end);
            expect(result).not.toBeNull();
            const alphaIdx = result!.indexOf('alpha');
            const zebraIdx = result!.indexOf('zebra');
            expect(alphaIdx).toBeLessThan(zebraIdx);
        });

        it('should not touch patterns outside selection', () => {
            const input = `const {
    zzz,
    aaa,
} = first;

const {
    bbb,
    ccc,
} = second;`;
            // Select only the first destructuring
            const end = input.indexOf('} = first;') + '} = first;'.length;
            const result = sortPropertiesInSelection(input, 0, end);
            expect(result).not.toBeNull();
            // First destructuring is sorted
            const aaaIdx = result!.indexOf('aaa');
            const zzzIdx = result!.indexOf('zzz');
            expect(aaaIdx).toBeLessThan(zzzIdx);
            // Second destructuring is untouched (bbb before ccc)
            const bbbIdx = result!.indexOf('bbb');
            const cccIdx = result!.indexOf('ccc');
            expect(bbbIdx).toBeLessThan(cccIdx);
        });
    });

    describe('empty selection / no patterns', () => {
        it('should return null when no sortable patterns in selection', () => {
            const input = `const x = 1;\nconst y = 2;`;
            expect(sortPropertiesInSelection(input, 0, input.length)).toBeNull();
        });

        it('should return null for empty input', () => {
            expect(sortPropertiesInSelection('', 0, 0)).toBeNull();
        });

        it('should return null when selection covers only non-sortable code', () => {
            const input = `function foo() { return 42; }`;
            expect(sortPropertiesInSelection(input, 0, input.length)).toBeNull();
        });
    });

    describe('multiple patterns in selection', () => {
        it('should sort all patterns within selection', () => {
            const input = `const {
    longName,
    a,
} = props;

interface Foo {
    zzz: string;
    b: number;
}`;
            const result = sortSelection(input);
            // Both should be sorted
            const aIdx = result.indexOf('    a,');
            const longIdx = result.indexOf('    longName,');
            expect(aIdx).toBeLessThan(longIdx);

            const bIdx = result.indexOf('b:');
            const zzzIdx = result.indexOf('zzz:');
            expect(bIdx).toBeLessThan(zzzIdx);
        });
    });

    describe('nested patterns', () => {
        it('should handle nested destructuring within selection', () => {
            const input = `const {
    outer,
    inner: {
        longInner,
        b,
    },
} = obj;`;
            const result = sortSelection(input);
            expect(result).toContain('outer');
            expect(result).toContain('inner');
            expect(result).toContain('longInner');
            expect(result).toContain('b');
        });
    });

    describe('idempotence', () => {
        it('should produce the same result when applied twice on ObjectExpression', () => {
            const input = `const obj = {
    zebra: 1,
    alpha: 2,
    mango: 3,
};`;
            const first = sortSelection(input);
            const second = sortSelection(first);
            expect(first).toBe(second);
        });

        it('should produce the same result when applied twice on interface', () => {
            const input = `interface Props {
    zebra: string;
    alpha: number;
    mango: boolean;
}`;
            const first = sortSelection(input);
            const second = sortSelection(first);
            expect(first).toBe(second);
        });

        it('should produce the same result when applied twice on mixed patterns', () => {
            const input = `const {
    longName,
    a,
} = props;

const obj = {
    zzz: 1,
    bb: 2,
};`;
            const first = sortSelection(input);
            const second = sortSelection(first);
            expect(first).toBe(second);
        });
    });
});
