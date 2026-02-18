import { sortPropertiesInSelection } from '../../src/destructuring-sorter';

/** Helper: sort the entire text as if the user selected everything */
function sortSelection(input: string): string {
    return sortPropertiesInSelection(input, 0, input.length) ?? input;
}

describe('sortPropertiesInSelection — JSX attributes', () => {
    describe('basic JSX prop sorting', () => {
        it('should sort JSX attributes by length then alpha', () => {
            const input = `<YpSelect
    className='max-w-[300px]'
    placeholder='test'
    value={ val }
    options={ opts }
    onChange={ handler }
/>`;
            const result = sortSelection(input);
            const valueIdx = result.indexOf('value=');
            const optionsIdx = result.indexOf('options=');
            const onChangeIdx = result.indexOf('onChange=');
            const classNameIdx = result.indexOf('className=');
            const placeholderIdx = result.indexOf('placeholder=');
            // length order: value (5) < options (7) < onChange (8) < className (9) < placeholder (11)
            expect(valueIdx).toBeLessThan(optionsIdx);
            expect(optionsIdx).toBeLessThan(onChangeIdx);
            expect(onChangeIdx).toBeLessThan(classNameIdx);
            expect(classNameIdx).toBeLessThan(placeholderIdx);
        });
    });

    describe('boolean shorthand attributes first', () => {
        it('should place boolean shorthand props before valued props', () => {
            const input = `<YpDataTable
    hasPagination
    table={ table }
    showCount
    autoSizeColumns
    height={ 'calc(100vh - 526px)' }
    isLoading={ list?.isLoading }
    totalItems={ list?.data?.total_items }
/>`;
            const result = sortSelection(input);
            // Boolean shorthand props: showCount, hasPagination, autoSizeColumns
            // They should all come before valued props
            const showCountIdx = result.indexOf('showCount');
            const hasPaginationIdx = result.indexOf('hasPagination');
            const autoSizeColumnsIdx = result.indexOf('autoSizeColumns');
            const tableIdx = result.indexOf('table=');
            const heightIdx = result.indexOf('height=');
            const isLoadingIdx = result.indexOf('isLoading=');
            const totalItemsIdx = result.indexOf('totalItems=');

            // All booleans before all valued
            expect(showCountIdx).toBeLessThan(tableIdx);
            expect(hasPaginationIdx).toBeLessThan(tableIdx);
            expect(autoSizeColumnsIdx).toBeLessThan(tableIdx);

            // Booleans sorted by length: showCount (9) < hasPagination (13) < autoSizeColumns (15)
            expect(showCountIdx).toBeLessThan(hasPaginationIdx);
            expect(hasPaginationIdx).toBeLessThan(autoSizeColumnsIdx);

            // Valued sorted by length: table (5) < height (6) < isLoading (9) < totalItems (10)
            expect(tableIdx).toBeLessThan(heightIdx);
            expect(heightIdx).toBeLessThan(isLoadingIdx);
            expect(isLoadingIdx).toBeLessThan(totalItemsIdx);
        });
    });

    describe('spread attributes stay at the end', () => {
        it('should keep JSXSpreadAttribute at the end', () => {
            const input = `<Component
    {...rest}
    className='foo'
    id='bar'
/>`;
            const result = sortSelection(input);
            const idIdx = result.indexOf("id=");
            const classNameIdx = result.indexOf('className=');
            const spreadIdx = result.indexOf('{...rest}');
            // id before className (shorter)
            expect(idIdx).toBeLessThan(classNameIdx);
            // spread at the end
            expect(classNameIdx).toBeLessThan(spreadIdx);
        });
    });

    describe('nested objects in JSX props (recursive)', () => {
        it('should sort JSX attributes and nested object expressions', () => {
            const input = `<YpInput
    autoFocus
    type='search'
    className='w-[300px]'
    placeholder='Rechercher...'
    onChange={ (e) => handler(e.target.value) }
    icon={ {
        style: 'far',
        name: 'search',
        position: 'left',
    } }
/>`;
            const result = sortSelection(input);
            // Boolean shorthand first
            const autoFocusIdx = result.indexOf('autoFocus');
            const typeIdx = result.indexOf("type=");
            expect(autoFocusIdx).toBeLessThan(typeIdx);

            // Nested object should also be sorted: name (4) < style (5) < position (8)
            const nameIdx = result.indexOf("name: 'search'");
            const styleIdx = result.indexOf("style: 'far'");
            const positionIdx = result.indexOf("position: 'left'");
            expect(nameIdx).toBeLessThan(styleIdx);
            expect(styleIdx).toBeLessThan(positionIdx);
        });
    });

    describe('already sorted (no-op)', () => {
        it('should return null when JSX attributes are already sorted', () => {
            const input = `<Component
    autoFocus
    id='bar'
    className='foo'
/>`;
            const result = sortPropertiesInSelection(input, 0, input.length);
            // autoFocus (boolean, first), id (2 < 9), className (9) — already sorted
            expect(result).toBeNull();
        });
    });

    describe('single attribute (no-op)', () => {
        it('should return null when JSX element has only one attribute', () => {
            const input = `<Component
    className='foo'
/>`;
            const result = sortPropertiesInSelection(input, 0, input.length);
            expect(result).toBeNull();
        });
    });

    describe('single-line JSX (no-op)', () => {
        it('should not sort single-line JSX attributes', () => {
            const input = `<Component className='foo' id='bar' />`;
            const result = sortPropertiesInSelection(input, 0, input.length);
            expect(result).toBeNull();
        });
    });

    describe('multiple JSX elements in selection', () => {
        it('should sort attributes on all JSX elements in selection', () => {
            const input = `<div>
    <YpSelect
        className='max-w-[300px]'
        placeholder='test'
        value={ val }
    />
    <YpInput
        type='search'
        autoFocus
        className='w-[300px]'
    />
</div>`;
            const result = sortSelection(input);
            // YpSelect: value (5) < className (9) < placeholder (11)
            const valueIdx = result.indexOf('value=');
            const selectClassIdx = result.indexOf("className='max-w-[300px]'");
            expect(valueIdx).toBeLessThan(selectClassIdx);

            // YpInput: autoFocus (boolean first), then type (4) < className (9)
            const autoFocusIdx = result.indexOf('autoFocus');
            const typeIdx = result.indexOf("type=");
            expect(autoFocusIdx).toBeLessThan(typeIdx);
        });
    });

    describe('idempotence', () => {
        it('should produce the same result when applied twice', () => {
            const input = `<YpDataTable
    hasPagination
    table={ table }
    showCount
    autoSizeColumns
    height={ 'calc(100vh - 526px)' }
/>`;
            const first = sortSelection(input);
            const second = sortSelection(first);
            expect(first).toBe(second);
        });

        it('should be idempotent with nested objects', () => {
            const input = `<YpInput
    autoFocus
    type='search'
    icon={ {
        style: 'far',
        name: 'search',
        position: 'left',
    } }
/>`;
            const first = sortSelection(input);
            const second = sortSelection(first);
            expect(first).toBe(second);
        });
    });

    describe('mixed JSX and non-JSX patterns', () => {
        it('should sort both JSX attributes and object expressions in selection', () => {
            const input = `const config = {
    zebra: 1,
    alpha: 2,
};

const el = <Component
    className='foo'
    id='bar'
/>;`;
            const result = sortSelection(input);
            // Object sorted: alpha < zebra
            const alphaIdx = result.indexOf('alpha:');
            const zebraIdx = result.indexOf('zebra:');
            expect(alphaIdx).toBeLessThan(zebraIdx);

            // JSX sorted: id < className
            const idIdx = result.indexOf("id=");
            const classNameIdx = result.indexOf("className=");
            expect(idIdx).toBeLessThan(classNameIdx);
        });
    });
});
