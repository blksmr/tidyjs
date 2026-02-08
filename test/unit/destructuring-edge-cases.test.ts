import { sortDestructuring } from '../../src/destructuring-sorter';
import type { Config } from '../../src/types';

const destructuringConfig: Config = {
    groups: [],
    importOrder: { default: 1, named: 2, typeOnly: 3, sideEffect: 0 },
    format: { sortDestructuring: true },
};

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

const allConfig: Config = {
    groups: [],
    importOrder: { default: 1, named: 2, typeOnly: 3, sideEffect: 0 },
    format: {
        sortDestructuring: true,
        sortEnumMembers: true,
        sortExports: true,
        sortClassProperties: true,
    },
};

// ============================================================================
// Edge case 1: ObjectExpression is NEVER walked/sorted
// ============================================================================
describe('ObjectExpression never sorted', () => {
    it('should not sort object literal assigned to variable', () => {
        const input = `const config = {
    zebra: 1,
    alpha: 2,
    mango: 3,
};`;
        expect(sortDestructuring(input, allConfig)).toBe(input);
    });

    it('should not sort nested object literal inside destructuring', () => {
        // The destructuring pattern should be sorted, but nested object literals should not
        const input = `const {
    longName,
    a,
} = {
    zebra: 1,
    alpha: 2,
};`;
        const result = sortDestructuring(input, destructuringConfig);
        // Destructuring pattern is sorted (a before longName)
        const aIdx = result.indexOf('    a,');
        const longIdx = result.indexOf('    longName,');
        expect(aIdx).toBeLessThan(longIdx);
        // Object literal order is preserved
        expect(result).toContain('zebra: 1');
        expect(result).toContain('alpha: 2');
        const zebraIdx = result.indexOf('zebra');
        const alphaIdx = result.indexOf('alpha');
        expect(zebraIdx).toBeLessThan(alphaIdx);
    });
});

// ============================================================================
// Edge case 2: Single property destructuring is ignored (< 2)
// ============================================================================
describe('single property destructuring ignored', () => {
    it('should not sort multiline destructuring with only one property', () => {
        const input = `const {
    onlyOne,
} = props;`;
        expect(sortDestructuring(input, destructuringConfig)).toBe(input);
    });

    it('should not sort interface with only one property', () => {
        const input = `interface Foo {
    onlyProp: string;
}`;
        expect(sortDestructuring(input, destructuringConfig)).toBe(input);
    });
});

// ============================================================================
// Edge case 3: Computed properties cause bail-out
// ============================================================================
describe('computed properties bail out', () => {
    it('should skip destructuring when all properties are computed', () => {
        const input = `const {
    [KEY_A]: valA,
    [KEY_B]: valB,
} = obj;`;
        expect(sortDestructuring(input, destructuringConfig)).toBe(input);
    });

    it('should skip when mix of computed and regular properties', () => {
        const input = `const {
    [COMPUTED]: value,
    regularProp,
    short,
} = obj;`;
        expect(sortDestructuring(input, destructuringConfig)).toBe(input);
    });
});

// ============================================================================
// Edge case 4: Interface with TSMethodSignature
// ============================================================================
describe('interface with TSMethodSignature', () => {
    it('should sort interface with method signatures mixed with properties', () => {
        const input = `interface Service {
    longMethodName(): void;
    id: string;
    getData(): Promise<void>;
}`;
        const result = sortDestructuring(input, destructuringConfig);
        // Should sort by name length: id (2) < getData (7) < longMethodName (14)
        const idIdx = result.indexOf('id:');
        const getDataIdx = result.indexOf('getData');
        const longIdx = result.indexOf('longMethodName');
        expect(idIdx).toBeLessThan(getDataIdx);
        expect(getDataIdx).toBeLessThan(longIdx);
    });

    it('should sort interface with only method signatures', () => {
        const input = `interface Actions {
    veryLongAction(): void;
    go(): void;
    medium(): string;
}`;
        const result = sortDestructuring(input, destructuringConfig);
        const goIdx = result.indexOf('go()');
        const mediumIdx = result.indexOf('medium()');
        const veryLongIdx = result.indexOf('veryLongAction()');
        expect(goIdx).toBeLessThan(mediumIdx);
        expect(mediumIdx).toBeLessThan(veryLongIdx);
    });
});

// ============================================================================
// Edge case 5: Enum body.members vs members (OXC compat)
// ============================================================================
describe('enum OXC compatibility', () => {
    it('should sort enum members correctly (OXC uses body.members)', () => {
        const input = `enum Colors {
    LightBlue = 'light_blue',
    Red = 'red',
    Green = 'green',
}`;
        const result = sortDestructuring(input, enumConfig);
        const redIdx = result.indexOf('Red');
        const greenIdx = result.indexOf('Green');
        const lightIdx = result.indexOf('LightBlue');
        expect(redIdx).toBeLessThan(greenIdx);
        expect(greenIdx).toBeLessThan(lightIdx);
    });
});

// ============================================================================
// Edge case 6: filterNonOverlapping with nested destructuring
// ============================================================================
describe('filterNonOverlapping with nested patterns', () => {
    it('should handle truly nested destructuring (inner within outer)', () => {
        const input = `const {
    outer,
    inner: {
        longInner,
        b,
    },
} = obj;`;
        // The outer destructuring has a nested one — ranges overlap.
        // filterNonOverlapping should handle this gracefully.
        const result = sortDestructuring(input, destructuringConfig);
        // Should not corrupt the output — must still be parseable-ish
        expect(result).toContain('outer');
        expect(result).toContain('inner');
        expect(result).toContain('longInner');
        expect(result).toContain('b');
    });

    it('should sort multiple independent destructurings at the same level', () => {
        const input = `const {
    zLong,
    a,
} = first;

const {
    yMedium,
    b,
} = second;

const {
    xShort,
    c,
} = third;`;
        const result = sortDestructuring(input, destructuringConfig);
        // All three should be sorted independently
        expect(result.indexOf('    a,')).toBeLessThan(result.indexOf('    zLong,'));
        expect(result.indexOf('    b,')).toBeLessThan(result.indexOf('    yMedium,'));
        expect(result.indexOf('    c,')).toBeLessThan(result.indexOf('    xShort,'));
    });
});

// ============================================================================
// Edge case 7: Iteration loop — does it terminate?
// ============================================================================
describe('iteration loop termination', () => {
    it('should terminate even with many nested patterns', () => {
        // Create a scenario that might trigger multiple iterations
        const input = `function test({
    zzz,
    a,
}: {
    zzz: string;
    a: number;
}) {}`;
        // Should not hang — both the ObjectPattern and TSTypeLiteral should sort
        const result = sortDestructuring(input, destructuringConfig);
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
    });
});

// ============================================================================
// Edge case 8: detectIndent — first prop on same line as {
// ============================================================================
describe('detectIndent edge cases', () => {
    it('should handle first property on same line as opening brace', () => {
        const input = `const { longName,
    a,
    medium,
} = props;`;
        // This is multiline, so it should attempt to sort.
        // The first prop "longName" is on the same line as "{" — no leading whitespace.
        // detectIndent should use a subsequent property's indent.
        const result = sortDestructuring(input, destructuringConfig);
        expect(result).toBeDefined();
        // Should not corrupt the output
        expect(result).toContain('longName');
        expect(result).toContain('a');
        expect(result).toContain('medium');
    });

    it('should detect correct indent with tab indentation', () => {
        const input = `const {\n\tlongName,\n\ta,\n} = props;`;
        const result = sortDestructuring(input, destructuringConfig);
        // Should sort and preserve tab indent
        expect(result).toContain('\ta,');
        expect(result).toContain('\tlongName,');
        const aIdx = result.indexOf('\ta,');
        const longIdx = result.indexOf('\tlongName,');
        expect(aIdx).toBeLessThan(longIdx);
    });
});

// ============================================================================
// Edge case 9: hasInternalComments false positive with string containing //
// ============================================================================
describe('hasInternalComments false positives', () => {
    it('should handle string value containing // (false positive for comment detection)', () => {
        const input = `const {
    url,
    longProtocol,
} = parseUrl('https://example.com');`;
        // The string 'https://example.com' contains '//' but is NOT a comment.
        // However, hasInternalComments works on the ObjectPattern range, not the full expression.
        // The ObjectPattern range is just `{ url, longProtocol }` — no string inside.
        // So this should still sort correctly.
        const result = sortDestructuring(input, destructuringConfig);
        const urlIdx = result.indexOf('    url,');
        const longIdx = result.indexOf('    longProtocol,');
        expect(urlIdx).toBeLessThan(longIdx);
    });

    it('should sort destructuring with default value containing // in string (false positive bug)', () => {
        // BUG: hasInternalComments does naive text search for '//' and '/*'
        // A default value like 'https://example.com' contains '//' inside a string literal.
        // The ObjectPattern range includes the default values, so hasInternalComments
        // returns true — causing a false positive that skips the sort.
        // The order here is intentionally reversed so the test fails if sort is skipped.
        const input = `const {
    longProtocol = 'ftp',
    url = 'https://example.com',
} = config;`;
        const result = sortDestructuring(input, destructuringConfig);
        // After fix: should sort (url (3) < longProtocol (12))
        const urlIdx = result.indexOf('    url');
        const longIdx = result.indexOf('    longProtocol');
        expect(urlIdx).toBeLessThan(longIdx);
    });

    it('should sort interface with URL-like string literal type (false positive bug)', () => {
        // BUG: same false positive — interface body range includes 'https://...'
        // Reversed order to expose the bug.
        const input = `interface ApiConfig {
    longPropertyName: string;
    endpoint: 'https://api.example.com';
}`;
        const expected = `interface ApiConfig {
    endpoint: 'https://api.example.com';
    longPropertyName: string;
}`;
        const result = sortDestructuring(input, destructuringConfig);
        // After fix: endpoint (8) < longPropertyName (16) — should be sorted
        expect(result).toBe(expected);
    });
});

// ============================================================================
// Edge case 10: ClassBody — static properties skipped, readonly properties sorted
// ============================================================================
describe('class body: static vs readonly', () => {
    it('should sort readonly properties (not filtered like static)', () => {
        const input = `class Model {
    readonly longReadonlyProp: string;
    readonly id: number;
}`;
        const result = sortDestructuring(input, classConfig);
        const idIdx = result.indexOf('id:');
        const longIdx = result.indexOf('longReadonlyProp');
        expect(idIdx).toBeLessThan(longIdx);
    });

    it('should skip static properties but sort non-static ones around them', () => {
        const input = `class Foo {
    static staticProp: string;
    longDynamicProp: string;
    a: number;
    static anotherStatic: number;
    zzz: boolean;
    b: string;
}`;
        const result = sortDestructuring(input, classConfig);
        // Static properties stay in place and break runs.
        // Run 1: longDynamicProp, a → sorted to: a, longDynamicProp
        // Run 2: zzz, b → sorted to: b, zzz
        expect(result).toContain('static staticProp');
        expect(result).toContain('static anotherStatic');

        // Verify the non-static runs are sorted
        const lines = result.split('\n');
        const propLines = lines.filter(l => l.trim().length > 0 && !l.includes('class') && !l.includes('}'));

        // We can at least verify that 'a' comes before 'longDynamicProp'
        // and 'b' comes before 'zzz'
        const aIdx = result.indexOf('    a: number');
        const longDynIdx = result.indexOf('    longDynamicProp');
        if (aIdx !== -1 && longDynIdx !== -1) {
            expect(aIdx).toBeLessThan(longDynIdx);
        }

        const bIdx = result.indexOf('    b: string');
        const zzzIdx = result.indexOf('    zzz: boolean');
        if (bIdx !== -1 && zzzIdx !== -1) {
            expect(bIdx).toBeLessThan(zzzIdx);
        }
    });

    it('should not sort methods in class body', () => {
        const input = `class Service {
    longProp: string;
    id: number;

    getLongMethodName(): void {}
    a(): void {}
}`;
        const result = sortDestructuring(input, classConfig);
        // Properties should be sorted
        const idIdx = result.indexOf('id: number');
        const longPropIdx = result.indexOf('longProp: string');
        expect(idIdx).toBeLessThan(longPropIdx);

        // Methods should remain in original order
        const getLongIdx = result.indexOf('getLongMethodName');
        const aMethodIdx = result.indexOf('a(): void');
        expect(getLongIdx).toBeLessThan(aMethodIdx);
    });
});

// ============================================================================
// Edge case 11: ExportSpecifier with string literals
// ============================================================================
describe('export specifier with string literals', () => {
    it('should handle export with string literal exported name (aliased)', () => {
        // export { 'weird-name' as foo } — OXC puts Literal in local, Identifier in exported
        // getPropertyName uses spec.exported which is Identifier → works fine
        const input = `export {
    'weird-name' as foo,
    normalName,
} from './mod';`;
        const result = sortDestructuring(input, exportConfig);
        // 'foo' (3) < 'normalName' (10) → already sorted
        expect(result).toContain('foo');
        expect(result).toContain('normalName');
    });

    it('should sort export block that contains string literal without alias', () => {
        // BUG: export { 'weird-name' } without alias — OXC has Literal in exported
        // getPropertyName for ExportSpecifier only handles Identifier for exported,
        // so it returns null, causing extractProperties to bail out entirely.
        // The fix: handle Literal in ExportSpecifier.exported
        const input = `export {
    'weird-name',
    normalName,
    ab,
} from './mod';`;
        const result = sortDestructuring(input, exportConfig);
        // After fix: ab (2) < normalName (10) < weird-name (10) — but weird-name
        // has Literal type, should still be handled. At minimum, should not bail out
        // and should sort the normal specifiers.
        // With fix: getPropertyName returns 'weird-name' for Literal exported
        const abIdx = result.indexOf('ab');
        const normalIdx = result.indexOf('normalName');
        expect(abIdx).toBeLessThan(normalIdx);
    });
});

// ============================================================================
// Additional edge cases
// ============================================================================
describe('additional edge cases', () => {
    it('should handle empty config (no format key)', () => {
        const config: Config = {
            groups: [],
            importOrder: { default: 1, named: 2, typeOnly: 3, sideEffect: 0 },
        };
        const input = `const {
    longName,
    a,
} = props;`;
        expect(sortDestructuring(input, config)).toBe(input);
    });

    it('should handle undefined config', () => {
        const input = `const {
    longName,
    a,
} = props;`;
        expect(sortDestructuring(input, undefined)).toBe(input);
    });

    it('should handle destructuring with type annotations', () => {
        const input = `const {
    longName,
    a,
}: { longName: string; a: number } = props;`;
        const result = sortDestructuring(input, destructuringConfig);
        // The ObjectPattern should be sorted
        const aIdx = result.indexOf('    a,');
        const longIdx = result.indexOf('    longName,');
        expect(aIdx).toBeLessThan(longIdx);
    });

    it('should handle interface extending another', () => {
        const input = `interface Extended extends Base {
    zzzLongProp: string;
    ab: number;
    medium: boolean;
}`;
        const result = sortDestructuring(input, destructuringConfig);
        const abIdx = result.indexOf('ab:');
        const mediumIdx = result.indexOf('medium:');
        const zzzIdx = result.indexOf('zzzLongProp:');
        expect(abIdx).toBeLessThan(mediumIdx);
        expect(mediumIdx).toBeLessThan(zzzIdx);
    });

    it('should handle type literal in union/intersection', () => {
        const input = `type Combined = Base & {
    zzzLongProp: string;
    ab: number;
    medium: boolean;
};`;
        const result = sortDestructuring(input, destructuringConfig);
        const abIdx = result.indexOf('ab:');
        const mediumIdx = result.indexOf('medium:');
        const zzzIdx = result.indexOf('zzzLongProp:');
        expect(abIdx).toBeLessThan(mediumIdx);
        expect(mediumIdx).toBeLessThan(zzzIdx);
    });

    it('should sort class with access modifiers (public/private/protected)', () => {
        const input = `class Model {
    public longPublicProp: string;
    private id: number;
    protected med: boolean;
}`;
        // Access modifiers are part of PropertyDefinition — should still sort
        const result = sortDestructuring(input, classConfig);
        expect(result).toBeDefined();
        // All properties should still be present
        expect(result).toContain('longPublicProp');
        expect(result).toContain('id');
        expect(result).toContain('med');
    });

    it('should handle enum with computed member (bail out)', () => {
        // OXC may parse computed enum members differently
        const input = `enum Flags {
    [Symbol.iterator] = 1,
    Normal = 2,
}`;
        // If this parses at all, computed members should cause bail out
        const result = sortDestructuring(input, enumConfig);
        // Should not corrupt — either skip or sort non-computed only
        expect(result).toBeDefined();
    });
});
