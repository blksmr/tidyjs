import { sortPropertiesInSelection } from '../../src/destructuring-sorter';
import type { Config } from '../../src/types';

/** Helper: sort the entire text as if the user selected everything */
function sortSelection(input: string, config?: Config): string {
    return sortPropertiesInSelection(input, 0, input.length, config) ?? input;
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

    describe('preserveComments option', () => {
        const inputWithComments = `type TProps = {
    needExportConfirmation: boolean;
    // Select props
    selectProps?: string;

    // Analyses select props
    showAnalyse?: boolean;
    analysesValue?: string;
};`;

        const inputWithoutComments = `type TProps = {
    needExportConfirmation: boolean;
    selectProps?: string;
    showAnalyse?: boolean;
    analysesValue?: string;
};`;

        it('should sort and move comments with their properties by default', () => {
            const result = sortSelection(inputWithComments);
            // Properties are sorted by length, comments travel with their property
            const selectIdx = result.indexOf('selectProps');
            const showIdx = result.indexOf('showAnalyse');
            const analysesIdx = result.indexOf('analysesValue');
            const needIdx = result.indexOf('needExportConfirmation');
            expect(selectIdx).toBeLessThan(showIdx);
            expect(showIdx).toBeLessThan(analysesIdx);
            expect(analysesIdx).toBeLessThan(needIdx);

            // Comments should still be present and before their associated property
            const selectCommentIdx = result.indexOf('// Select props');
            const analysesCommentIdx = result.indexOf('// Analyses select props');
            expect(selectCommentIdx).not.toBe(-1);
            expect(analysesCommentIdx).not.toBe(-1);
            expect(selectCommentIdx).toBeLessThan(selectIdx);
            expect(analysesCommentIdx).toBeLessThan(showIdx);
        });

        it('should move comments with properties when preserveComments is explicitly true', () => {
            const config = { format: { preserveComments: true } } as Config;
            const result = sortSelection(inputWithComments, config);
            // Comments should travel with their property
            expect(result).toContain('// Select props');
            expect(result).toContain('// Analyses select props');
            const selectCommentIdx = result.indexOf('// Select props');
            const selectIdx = result.indexOf('selectProps');
            expect(selectCommentIdx).toBeLessThan(selectIdx);
        });

        it('should sort and strip comments when preserveComments is false', () => {
            const config = { format: { preserveComments: false } } as Config;
            const result = sortSelection(inputWithComments, config);
            // Comments are stripped, properties are sorted
            expect(result).not.toContain('// Select props');
            expect(result).not.toContain('// Analyses select props');
            const selectIdx = result.indexOf('selectProps');
            const showIdx = result.indexOf('showAnalyse');
            const analysesIdx = result.indexOf('analysesValue');
            const needIdx = result.indexOf('needExportConfirmation');
            expect(selectIdx).toBeLessThan(showIdx);
            expect(showIdx).toBeLessThan(analysesIdx);
            expect(analysesIdx).toBeLessThan(needIdx);
        });

        it('should sort blocks without comments regardless of preserveComments', () => {
            const result = sortSelection(inputWithoutComments);
            const selectIdx = result.indexOf('selectProps');
            const showIdx = result.indexOf('showAnalyse');
            const analysesIdx = result.indexOf('analysesValue');
            const needIdx = result.indexOf('needExportConfirmation');
            expect(selectIdx).toBeLessThan(showIdx);
            expect(showIdx).toBeLessThan(analysesIdx);
            expect(analysesIdx).toBeLessThan(needIdx);
        });

        it('should move comments with object literal properties by default', () => {
            const input = `const obj = {
    // Category A
    zebra: 1,
    alpha: 2,
};`;
            const result = sortSelection(input);
            const alphaIdx = result.indexOf('alpha:');
            const zebraIdx = result.indexOf('zebra:');
            expect(alphaIdx).toBeLessThan(zebraIdx);
            // Comment travels with zebra
            const commentIdx = result.indexOf('// Category A');
            expect(commentIdx).not.toBe(-1);
            expect(commentIdx).toBeLessThan(zebraIdx);
        });

        it('should strip comments from object literals when preserveComments is false', () => {
            const input = `const obj = {
    // Category A
    zebra: 1,
    alpha: 2,
};`;
            const config = { format: { preserveComments: false } } as Config;
            const result = sortSelection(input, config);
            const alphaIdx = result.indexOf('alpha:');
            const zebraIdx = result.indexOf('zebra:');
            expect(alphaIdx).toBeLessThan(zebraIdx);
            expect(result).not.toContain('// Category A');
        });

        it('should discard blank lines between properties but keep comments', () => {
            const input = `type T = {
    propC: boolean;

    // Section B
    propB: number;

    // Section A
    propA: string;
};`;
            const result = sortSelection(input);
            // Sorted: propA, propB, propC — comments travel, blank lines discarded
            expect(result).toContain('// Section A');
            expect(result).toContain('// Section B');
            expect(result).not.toContain('\n\n');

            const sectionAIdx = result.indexOf('// Section A');
            const propAIdx = result.indexOf('propA');
            expect(sectionAIdx).toBeLessThan(propAIdx);
        });

        it('should be idempotent with comments preserved', () => {
            const first = sortSelection(inputWithComments);
            const second = sortSelection(first);
            expect(first).toBe(second);
        });

        it('should handle real-world type with section comments', () => {
            const input = `type TProps = {
    needExportConfirmation: boolean;
    // Select props (vues ou autres)
    selectProps?: Partial<string>;

    // Analyses select props
    showAnalyse?: boolean;
    analysesValue?: string | null;

    // Export actions
    exportOptions?: string[];
    onExport?: (value: string | null) => void;

    // Preview button (optionnel)
    onPreview?: () => void;
    previewLabel?: string;

    // Loading state global
    isLoadingData?: boolean;
};`;
            const result = sortSelection(input);

            // All section comments should be preserved
            expect(result).toContain('// Select props (vues ou autres)');
            expect(result).toContain('// Analyses select props');
            expect(result).toContain('// Export actions');
            expect(result).toContain('// Preview button (optionnel)');
            expect(result).toContain('// Loading state global');

            // Each comment should appear before its associated property
            const selectComment = result.indexOf('// Select props (vues ou autres)');
            const selectProp = result.indexOf('selectProps');
            expect(selectComment).toBeLessThan(selectProp);

            const analysesComment = result.indexOf('// Analyses select props');
            const showAnalyse = result.indexOf('showAnalyse');
            expect(analysesComment).toBeLessThan(showAnalyse);

            // Properties should be sorted by length
            const onExportIdx = result.indexOf('onExport');
            const onPreviewIdx = result.indexOf('onPreview');
            const selectPropsIdx = result.indexOf('selectProps');
            expect(onExportIdx).toBeLessThan(onPreviewIdx);
            expect(onPreviewIdx).toBeLessThan(selectPropsIdx);
        });

        it('should sort large type with many comments and blank lines', () => {
            const input = `type TProps = {
    onExport?: (value: string | null) => void;
    // Preview button (optionnel)
    onPreview?: () => void;

    // Hide toolbar condition
    hideToolbar?: boolean;
    // Select props (vues ou autres)
    selectProps?: Partial<TYpSelectProps>;

    // Analyses select props
    showAnalyse?: boolean;
    previewLabel?: string;
    analysesValue?: string | null;

    // Export actions
    exportOptions?: TYpSelectOption[];

    // Loading state global
    isLoadingData?: boolean;
    analysesOptions?: TYpSelectOption[];
    onAnalysesChange?: (value: string | null, event?: SyntheticEvent<HTMLElement, Event>) => void;

    // Additional actions
    additionalActions?: ReactNode;
    exportPlaceholder?: string;
    isLoadingAnalyses?: boolean;

    // Custom content to display after toolbar
    afterToolbarContent?: ReactNode;
    needExportConfirmation: boolean;

    // Error state - disable selects when technical error
    isDisabledByTechnicalError?: boolean;
};`;
            const result = sortPropertiesInSelection(input, 0, input.length);
            expect(result).not.toBeNull();
            // Should be sorted by length
            const onExportIdx = result!.indexOf('onExport');
            const hideToolbarIdx = result!.indexOf('hideToolbar');
            expect(onExportIdx).toBeLessThan(hideToolbarIdx);
        });
    });
});
