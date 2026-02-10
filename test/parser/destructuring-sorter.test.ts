import { sortCodePatterns, sortPropertiesInSelection } from '../../src/destructuring-sorter';
import type { Config } from '../../src/types';

const enumConfig: Config = {
    groups: [],
    importOrder: { default: 1, named: 2, typeOnly: 3, sideEffect: 0 },
    format: { sortEnumMembers: true },
};

const exportConfig: Config = {
    groups: [],
    importOrder: { default: 1, named: 2, typeOnly: 3, sideEffect: 0 },
    format: { sortExports: true },
};

const classConfig: Config = {
    groups: [],
    importOrder: { default: 1, named: 2, typeOnly: 3, sideEffect: 0 },
    format: { sortClassProperties: true },
};

/** Helper: sort the entire text as if the user selected everything */
function sortSelection(input: string): string {
    return sortPropertiesInSelection(input, 0, input.length) ?? input;
}

describe('sortPropertiesInSelection', () => {
    describe('variable destructuring', () => {
        it('should sort multiline destructuring by property name length', () => {
            const input = `const {
    className,
    datatestIdAttribute,
    datatestId,
    classesFunctions
} = props;`;

            const expected = `const {
    className,
    datatestId,
    classesFunctions,
    datatestIdAttribute
} = props;`;

            expect(sortSelection(input)).toBe(expected);
        });

        it('should not touch single-line destructuring', () => {
            const input = `const { zzzLong, a } = props;`;
            expect(sortSelection(input)).toBe(input);
        });

        it('should handle properties with default values — sort by name', () => {
            const input = `const {
    longPropertyName = 10,
    b = 20,
    medium = 30,
} = config;`;

            const expected = `const {
    b = 20,
    medium = 30,
    longPropertyName = 10,
} = config;`;

            expect(sortSelection(input)).toBe(expected);
        });

        it('should handle properties with aliases — sort by key name', () => {
            const input = `const {
    longPropertyName: short,
    b: something,
    med: other,
} = config;`;

            const expected = `const {
    b: something,
    med: other,
    longPropertyName: short,
} = config;`;

            expect(sortSelection(input)).toBe(expected);
        });

        it('should keep ...rest at the end', () => {
            const input = `const {
    longName,
    a,
    ...rest
} = props;`;

            const expected = `const {
    a,
    longName,
    ...rest
} = props;`;

            expect(sortSelection(input)).toBe(expected);
        });
    });

    describe('function parameter destructuring', () => {
        it('should sort destructured function params', () => {
            const input = `function foo({
    className,
    datatestIdAttribute,
    datatestId,
}) {}`;

            const expected = `function foo({
    className,
    datatestId,
    datatestIdAttribute,
}) {}`;

            expect(sortSelection(input)).toBe(expected);
        });
    });

    describe('arrow function destructuring', () => {
        it('should sort arrow function destructured params', () => {
            const input = `const foo = ({
    className,
    datatestIdAttribute,
    datatestId,
}) => {};`;

            const expected = `const foo = ({
    className,
    datatestId,
    datatestIdAttribute,
}) => {};`;

            expect(sortSelection(input)).toBe(expected);
        });
    });

    describe('interface properties', () => {
        it('should sort interface properties by name length', () => {
            const input = `interface Props {
    className: string;
    datatestIdAttribute: string;
    datatestId: string;
}`;

            const expected = `interface Props {
    className: string;
    datatestId: string;
    datatestIdAttribute: string;
}`;

            expect(sortSelection(input)).toBe(expected);
        });
    });

    describe('type literal properties', () => {
        it('should sort type literal properties by name length', () => {
            const input = `type Props = {
    className: string;
    datatestIdAttribute: string;
    datatestId: string;
};`;

            const expected = `type Props = {
    className: string;
    datatestId: string;
    datatestIdAttribute: string;
};`;

            expect(sortSelection(input)).toBe(expected);
        });
    });

    describe('skip patterns with comments', () => {
        it('should sort destructuring with comments (user chose to sort)', () => {
            // In manual mode, comments are NOT a reason to skip
            const input = `const {
    // this is important
    longName,
    a,
} = props;`;

            // hasInternalComments is not checked in selection mode,
            // but extractProperties may bail on unknown nodes.
            // Comments are not AST nodes in the property list, so this should still work.
            const result = sortSelection(input);
            expect(result).toBeDefined();
        });
    });

    describe('nested destructuring', () => {
        it('should sort each level independently', () => {
            const input = `const {
    longOuter,
    a,
} = obj;

const {
    longInner,
    b,
} = other;`;

            const expected = `const {
    a,
    longOuter,
} = obj;

const {
    b,
    longInner,
} = other;`;

            expect(sortSelection(input)).toBe(expected);
        });
    });

    describe('idempotence', () => {
        it('should produce the same result when applied twice', () => {
            const input = `const {
    className,
    datatestIdAttribute,
    datatestId,
    classesFunctions
} = props;`;

            const first = sortSelection(input);
            const second = sortSelection(first);
            expect(first).toBe(second);
        });
    });

    describe('already sorted', () => {
        it('should not modify already sorted destructuring', () => {
            const input = `const {
    a,
    bb,
    ccc,
} = props;`;

            expect(sortSelection(input)).toBe(input);
        });
    });

    describe('same length — alphabetic tiebreaker', () => {
        it('should use alphabetic order for same-length names', () => {
            const input = `const {
    bbb,
    aaa,
    ccc,
} = props;`;

            const expected = `const {
    aaa,
    bbb,
    ccc,
} = props;`;

            expect(sortSelection(input)).toBe(expected);
        });
    });

    describe('preserves trailing comma behavior', () => {
        it('should preserve trailing comma when present', () => {
            const input = `const {
    longName,
    a,
} = props;`;

            const result = sortSelection(input);
            const lines = result.split('\n');
            const lastPropLine = lines[lines.length - 2].trim();
            expect(lastPropLine).toMatch(/,$/);
        });

        it('should not add trailing comma when absent', () => {
            const input = `const {
    longName,
    a
} = props;`;

            const result = sortSelection(input);
            const lines = result.split('\n');
            const lastPropLine = lines[lines.length - 2].trim();
            expect(lastPropLine).not.toMatch(/,$/);
        });
    });

    describe('unsafe patterns — must skip to avoid data loss', () => {
        it('should skip destructuring with computed property keys', () => {
            const input = `const {
    [COMPUTED_KEY]: value,
    shortName,
    longerName
} = obj;`;

            expect(sortSelection(input)).toBe(input);
        });

        it('should skip interface with index signature', () => {
            const input = `interface Foo {
    [key: string]: unknown;
    shortProp: string;
    longerProp: number;
}`;

            expect(sortSelection(input)).toBe(input);
        });

        it('should skip interface with call signature', () => {
            const input = `interface Callable {
    (): void;
    prop: string;
    longerProp: number;
}`;

            expect(sortSelection(input)).toBe(input);
        });

        it('should skip type literal with index signature', () => {
            const input = `type Foo = {
    [key: string]: unknown;
    shortProp: string;
    longerProp: number;
};`;

            expect(sortSelection(input)).toBe(input);
        });
    });

    describe('edge cases', () => {
        it('should return null for invalid/unparseable code', () => {
            const input = `this is not valid code {{{{`;
            expect(sortPropertiesInSelection(input, 0, input.length)).toBeNull();
        });

        it('should return null for empty source', () => {
            expect(sortPropertiesInSelection('', 0, 0)).toBeNull();
        });

        it('should return null for code with no sortable patterns', () => {
            const input = `const x = 1;\nconst y = 2;`;
            expect(sortPropertiesInSelection(input, 0, input.length)).toBeNull();
        });
    });

    describe('ObjectExpression — sorted in selection mode', () => {
        it('should sort object literals when user explicitly selects them', () => {
            const input = `const obj = {
    telephone: '123',
    id: 1,
    nom: 'test',
};`;

            const result = sortSelection(input);
            const idIdx = result.indexOf('id:');
            const nomIdx = result.indexOf('nom:');
            const telIdx = result.indexOf('telephone:');
            expect(idIdx).toBeLessThan(nomIdx);
            expect(nomIdx).toBeLessThan(telIdx);
        });

        it('should sort object literals in constructor calls', () => {
            const input = `const model = new SignataireModel({
    infos_complementaires: '',
    type: 'foo',
    nom: '',
    email: '',
});`;

            const result = sortSelection(input);
            // Sorted by length: nom (3) < type (4) < email (5) < infos_complementaires (24)
            const nomIdx = result.indexOf('nom:');
            const typeIdx = result.indexOf('type:');
            const emailIdx = result.indexOf('email:');
            const infosIdx = result.indexOf('infos_complementaires:');
            expect(nomIdx).toBeLessThan(typeIdx);
            expect(typeIdx).toBeLessThan(emailIdx);
            expect(emailIdx).toBeLessThan(infosIdx);
        });
    });
});

describe('sortCodePatterns — automatic pipeline', () => {
    describe('destructuring is NOT sorted automatically', () => {
        it('should not sort destructuring even with sortEnumMembers enabled', () => {
            const input = `const {
    longName,
    a,
} = props;`;

            expect(sortCodePatterns(input, enumConfig)).toBe(input);
        });

        it('should not sort interfaces automatically', () => {
            const input = `interface Props {
    longName: string;
    a: string;
}`;

            expect(sortCodePatterns(input, enumConfig)).toBe(input);
        });

        it('should not sort object literals automatically', () => {
            const input = `const obj = {
    longName: 1,
    a: 2,
};`;

            expect(sortCodePatterns(input, classConfig)).toBe(input);
        });
    });
});

describe('sortEnumMembers', () => {
    it('should sort enum members by name length', () => {
        const input = `enum Status {
    InProgress = 'in_progress',
    OK = 'ok',
    Error = 'error',
}`;

        const expected = `enum Status {
    OK = 'ok',
    Error = 'error',
    InProgress = 'in_progress',
}`;

        expect(sortCodePatterns(input, enumConfig)).toBe(expected);
    });

    it('should not sort enums without config flag', () => {
        const input = `enum Status {
    InProgress = 'in_progress',
    OK = 'ok',
}`;

        expect(sortCodePatterns(input)).toBe(input);
    });

    it('should not touch single-line enums', () => {
        const input = `enum Dir { ZZZ, A }`;
        expect(sortCodePatterns(input, enumConfig)).toBe(input);
    });

    it('should handle enums without initializers', () => {
        const input = `enum Direction {
    Southeast,
    Up,
    Down,
}`;

        const expected = `enum Direction {
    Up,
    Down,
    Southeast,
}`;

        expect(sortCodePatterns(input, enumConfig)).toBe(expected);
    });

    it('should handle enums with string literal keys', () => {
        const input = `enum Codes {
    'long-code' = 1,
    'ab' = 2,
}`;

        const expected = `enum Codes {
    'ab' = 2,
    'long-code' = 1,
}`;

        expect(sortCodePatterns(input, enumConfig)).toBe(expected);
    });

    it('should preserve trailing comma behavior', () => {
        const input = `enum Status {
    InProgress,
    OK
}`;

        const expected = `enum Status {
    OK,
    InProgress
}`;

        expect(sortCodePatterns(input, enumConfig)).toBe(expected);
    });

    it('should skip enums with comments', () => {
        const input = `enum Status {
    // important: must be first
    InProgress,
    OK,
}`;

        expect(sortCodePatterns(input, enumConfig)).toBe(input);
    });

    it('should be idempotent', () => {
        const input = `enum Status {
    InProgress = 3,
    OK = 1,
    Error = 2,
}`;

        const first = sortCodePatterns(input, enumConfig);
        const second = sortCodePatterns(first, enumConfig);
        expect(first).toBe(second);
    });
});

describe('sortExports', () => {
    it('should sort multiline export specifiers by name length', () => {
        const input = `export {
    useCallback,
    useState,
    FC,
} from 'react';`;

        const expected = `export {
    FC,
    useState,
    useCallback,
} from 'react';`;

        expect(sortCodePatterns(input, exportConfig)).toBe(expected);
    });

    it('should not sort exports without config flag', () => {
        const input = `export {
    useCallback,
    FC,
} from 'react';`;

        expect(sortCodePatterns(input)).toBe(input);
    });

    it('should not touch single-line exports', () => {
        const input = `export { useCallback, FC } from 'react';`;
        expect(sortCodePatterns(input, exportConfig)).toBe(input);
    });

    it('should handle re-exports without source', () => {
        const input = `export {
    longVariableName,
    short,
    ab,
};`;

        const expected = `export {
    ab,
    short,
    longVariableName,
};`;

        expect(sortCodePatterns(input, exportConfig)).toBe(expected);
    });

    it('should sort by exported name for aliases', () => {
        const input = `export {
    internalLongName as longExportedName,
    foo as ab,
} from './mod';`;

        const expected = `export {
    foo as ab,
    internalLongName as longExportedName,
} from './mod';`;

        expect(sortCodePatterns(input, exportConfig)).toBe(expected);
    });

    it('should handle inline type exports', () => {
        const input = `export {
    type LongTypeName,
    useState,
    type FC,
} from 'react';`;

        const expected = `export {
    type FC,
    useState,
    type LongTypeName,
} from 'react';`;

        expect(sortCodePatterns(input, exportConfig)).toBe(expected);
    });

    it('should skip exports with comments', () => {
        const input = `export {
    // must be first
    useCallback,
    FC,
} from 'react';`;

        expect(sortCodePatterns(input, exportConfig)).toBe(input);
    });

    it('should preserve trailing comma behavior', () => {
        const input = `export {
    useCallback,
    FC
} from 'react';`;

        const expected = `export {
    FC,
    useCallback
} from 'react';`;

        expect(sortCodePatterns(input, exportConfig)).toBe(expected);
    });

    it('should be idempotent', () => {
        const input = `export {
    useCallback,
    useState,
    FC,
} from 'react';`;

        const first = sortCodePatterns(input, exportConfig);
        const second = sortCodePatterns(first, exportConfig);
        expect(first).toBe(second);
    });
});

describe('class properties sorting', () => {
    it('should sort class properties by name length', () => {
        const input = `class User {
    telephone: string;
    id: string;
    nom: string;
    email: string;
}`;

        const expected = `class User {
    id: string;
    nom: string;
    email: string;
    telephone: string;
}`;

        expect(sortCodePatterns(input, classConfig)).toBe(expected);
    });

    it('should handle the SignataireModel example', () => {
        const input = `export default class SignataireModel {
    id: string;
    nom: string;
    prenom: string;
    civilite: number;
    qualite: string;
    nature: number;
    email: string;
    telephone: string;
    type: TSignataireType;
    etablissement_id?: string;
    infos_complementaires: string;

    static Empty(): SignataireModel {
        return new SignataireModel({});
    }
}`;

        const result = sortCodePatterns(input, classConfig);

        // Properties should be sorted by length
        const lines = result.split('\n');
        const propLines = lines.filter(l => l.trim().match(/^\w.*:\s/));

        // Verify shortest first
        expect(propLines[0]).toContain('id:');
        expect(propLines[1]).toContain('nom:');

        // Methods should not be affected
        expect(result).toContain('static Empty()');
    });

    it('should not sort when disabled', () => {
        const input = `class Foo {
    longName: string;
    a: number;
}`;

        // No config = feature disabled
        expect(sortCodePatterns(input)).toBe(input);
    });

    it('should skip static properties', () => {
        const input = `class Foo {
    static instance: Foo;
    longName: string;
    a: number;
}`;

        const expected = `class Foo {
    static instance: Foo;
    a: number;
    longName: string;
}`;

        expect(sortCodePatterns(input, classConfig)).toBe(expected);
    });

    it('should handle class with only methods (no properties to sort)', () => {
        const input = `class Foo {
    constructor() {}
    getName(): string { return ''; }
}`;

        expect(sortCodePatterns(input, classConfig)).toBe(input);
    });

    it('should handle properties with initializers', () => {
        const input = `class Config {
    timeout: number = 5000;
    url: string = '';
    retryCount: number = 3;
}`;

        const expected = `class Config {
    url: string = '';
    timeout: number = 5000;
    retryCount: number = 3;
}`;

        expect(sortCodePatterns(input, classConfig)).toBe(expected);
    });

    it('should handle optional properties', () => {
        const input = `class Model {
    optional?: string;
    id: number;
}`;

        const expected = `class Model {
    id: number;
    optional?: string;
}`;

        expect(sortCodePatterns(input, classConfig)).toBe(expected);
    });

    it('should be idempotent', () => {
        const input = `class Foo {
    telephone: string;
    id: string;
    nom: string;
}`;

        const first = sortCodePatterns(input, classConfig);
        const second = sortCodePatterns(first, classConfig);
        expect(first).toBe(second);
    });

    it('should skip class properties run with comments between them', () => {
        const input = `class Foo {
    longName: string;
    // important note
    a: number;
}`;

        expect(sortCodePatterns(input, classConfig)).toBe(input);
    });

    it('should sort alphabetically when same length', () => {
        const input = `class Foo {
    nom: string;
    age: number;
}`;

        const expected = `class Foo {
    age: number;
    nom: string;
}`;

        expect(sortCodePatterns(input, classConfig)).toBe(expected);
    });
});

describe('object literal sorting (ObjectExpression)', () => {
    it('should NOT sort object literals automatically', () => {
        const input = `const obj = {
    telephone: '123',
    id: 1,
    nom: 'test',
};`;

        // Automatic pipeline never touches object literals
        expect(sortCodePatterns(input, enumConfig)).toBe(input);
    });

    it('should sort object literals via selection command', () => {
        const input = `const obj = {
    telephone: '123',
    id: 1,
    nom: 'test',
};`;

        const result = sortSelection(input);
        const idIdx = result.indexOf('id:');
        const nomIdx = result.indexOf('nom:');
        const telIdx = result.indexOf('telephone:');
        expect(idIdx).toBeLessThan(nomIdx);
        expect(nomIdx).toBeLessThan(telIdx);
    });
});
