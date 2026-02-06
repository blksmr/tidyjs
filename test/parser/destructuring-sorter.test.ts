import { sortDestructuring } from '../../src/destructuring-sorter';
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

describe('sortDestructuring', () => {
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

            expect(sortDestructuring(input)).toBe(expected);
        });

        it('should not touch single-line destructuring', () => {
            const input = `const { zzzLong, a } = props;`;
            expect(sortDestructuring(input)).toBe(input);
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

            expect(sortDestructuring(input)).toBe(expected);
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

            expect(sortDestructuring(input)).toBe(expected);
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

            expect(sortDestructuring(input)).toBe(expected);
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

            expect(sortDestructuring(input)).toBe(expected);
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

            expect(sortDestructuring(input)).toBe(expected);
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

            expect(sortDestructuring(input)).toBe(expected);
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

            expect(sortDestructuring(input)).toBe(expected);
        });
    });

    describe('skip patterns with comments', () => {
        it('should skip destructuring with line comments', () => {
            const input = `const {
    // this is important
    longName,
    a,
} = props;`;

            expect(sortDestructuring(input)).toBe(input);
        });

        it('should skip destructuring with block comments', () => {
            const input = `const {
    /* comment */
    longName,
    a,
} = props;`;

            expect(sortDestructuring(input)).toBe(input);
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

            expect(sortDestructuring(input)).toBe(expected);
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

            const first = sortDestructuring(input);
            const second = sortDestructuring(first);
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

            expect(sortDestructuring(input)).toBe(input);
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

            expect(sortDestructuring(input)).toBe(expected);
        });
    });

    describe('preserves trailing comma behavior', () => {
        it('should preserve trailing comma when present', () => {
            const input = `const {
    longName,
    a,
} = props;`;

            const result = sortDestructuring(input);
            const lines = result.split('\n');
            const lastPropLine = lines[lines.length - 2].trim();
            expect(lastPropLine).toMatch(/,$/);
        });

        it('should not add trailing comma when absent', () => {
            const input = `const {
    longName,
    a
} = props;`;

            const result = sortDestructuring(input);
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

            expect(sortDestructuring(input)).toBe(input);
        });

        it('should skip interface with index signature', () => {
            const input = `interface Foo {
    [key: string]: unknown;
    shortProp: string;
    longerProp: number;
}`;

            expect(sortDestructuring(input)).toBe(input);
        });

        it('should skip interface with call signature', () => {
            const input = `interface Callable {
    (): void;
    prop: string;
    longerProp: number;
}`;

            expect(sortDestructuring(input)).toBe(input);
        });

        it('should skip type literal with index signature', () => {
            const input = `type Foo = {
    [key: string]: unknown;
    shortProp: string;
    longerProp: number;
};`;

            expect(sortDestructuring(input)).toBe(input);
        });
    });

    describe('edge cases', () => {
        it('should handle invalid/unparseable code gracefully', () => {
            const input = `this is not valid code {{{{`;
            expect(sortDestructuring(input)).toBe(input);
        });

        it('should handle empty source', () => {
            expect(sortDestructuring('')).toBe('');
        });

        it('should handle code with no destructuring', () => {
            const input = `const x = 1;\nconst y = 2;`;
            expect(sortDestructuring(input)).toBe(input);
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

        expect(sortDestructuring(input, enumConfig)).toBe(expected);
    });

    it('should not sort enums without config flag', () => {
        const input = `enum Status {
    InProgress = 'in_progress',
    OK = 'ok',
}`;

        expect(sortDestructuring(input)).toBe(input);
    });

    it('should not touch single-line enums', () => {
        const input = `enum Dir { ZZZ, A }`;
        expect(sortDestructuring(input, enumConfig)).toBe(input);
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

        expect(sortDestructuring(input, enumConfig)).toBe(expected);
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

        expect(sortDestructuring(input, enumConfig)).toBe(expected);
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

        expect(sortDestructuring(input, enumConfig)).toBe(expected);
    });

    it('should skip enums with comments', () => {
        const input = `enum Status {
    // important: must be first
    InProgress,
    OK,
}`;

        expect(sortDestructuring(input, enumConfig)).toBe(input);
    });

    it('should be idempotent', () => {
        const input = `enum Status {
    InProgress = 3,
    OK = 1,
    Error = 2,
}`;

        const first = sortDestructuring(input, enumConfig);
        const second = sortDestructuring(first, enumConfig);
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

        expect(sortDestructuring(input, exportConfig)).toBe(expected);
    });

    it('should not sort exports without config flag', () => {
        const input = `export {
    useCallback,
    FC,
} from 'react';`;

        expect(sortDestructuring(input)).toBe(input);
    });

    it('should not touch single-line exports', () => {
        const input = `export { useCallback, FC } from 'react';`;
        expect(sortDestructuring(input, exportConfig)).toBe(input);
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

        expect(sortDestructuring(input, exportConfig)).toBe(expected);
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

        expect(sortDestructuring(input, exportConfig)).toBe(expected);
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

        expect(sortDestructuring(input, exportConfig)).toBe(expected);
    });

    it('should skip exports with comments', () => {
        const input = `export {
    // must be first
    useCallback,
    FC,
} from 'react';`;

        expect(sortDestructuring(input, exportConfig)).toBe(input);
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

        expect(sortDestructuring(input, exportConfig)).toBe(expected);
    });

    it('should be idempotent', () => {
        const input = `export {
    useCallback,
    useState,
    FC,
} from 'react';`;

        const first = sortDestructuring(input, exportConfig);
        const second = sortDestructuring(first, exportConfig);
        expect(first).toBe(second);
    });
});
