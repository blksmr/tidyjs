import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { formatSingleFile } from '../../src/batch-formatter';
import { ImportParser } from '../../src/parser';

import type { Config } from '../../src/types';

jest.mock('../../src/utils/log', () => ({
    logDebug: jest.fn(),
    logError: jest.fn(),
    logInfo: jest.fn(),
}));

jest.mock('vscode');

function writeFile(root: string, relativePath: string, content: string): string {
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
}

describe('Import corruption regression', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tidyjs-corruption-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('keeps a complex multi-group component file valid after formatting', async () => {
        writeFile(tmpDir, 'tsconfig.json', JSON.stringify({
            compilerOptions: {
                baseUrl: 'src',
            },
        }));

        const config: Config = {
            groups: [
                { name: 'Styles', order: 0, match: /^.+\.css$/ },
                {
                    name: 'Misc',
                    order: 1,
                    priority: 999,
                    default: true,
                    match: /^(react|react-.*|lodash|date-fns|uuid|@tanstack|@fortawesome)(\/|$)/,
                },
                { name: 'UI', order: 2, match: /^@\/components\/ui$/ },
                { name: '@/features', order: 3, match: /^@\/features/ },
                { name: '@/lib', order: 4, match: /^@\/lib/ },
            ],
            importOrder: { sideEffect: 0, default: 1, named: 2, typeOnly: 3 },
            format: {
                indent: 4,
                singleQuote: true,
                bracketSpacing: true,
                enforceNewlineAfterImports: true,
                removeUnusedImports: false,
                removeMissingModules: false,
                organizeReExports: false,
                sortEnumMembers: true,
                sortExports: true,
                sortClassProperties: true,
                sortTypeMembers: true,
            },
            pathResolution: {
                mode: 'absolute',
            },
            excludedFolders: [],
        };

        writeFile(tmpDir, 'src/@/lib/search.ts', 'export const useSearch = () => [] as unknown[];\n');
        writeFile(tmpDir, 'src/@/lib/table.ts', 'export const useTable = <T,>(value: T) => value;\n');
        writeFile(tmpDir, 'src/@/features/orders/models/OrderItemModel.ts', 'export default interface OrderItemModel { id: string; sku: string; name: string; quantity: number; unit_price: number; total: number; created_at: string; notes: string; }\n');
        writeFile(tmpDir, 'src/@/features/orders/providers/OrderItemFormProvider.ts', 'export default function useOrderItemFormProvider() { return { form: { getFieldDefinition: () => null }, fields: [], isLoading: false, lastAddedRowId: undefined, addedRowIds: new Set<string>(), modifiedRowIds: new Set<string>(), duplicateRow: () => undefined, deleteRows: () => undefined, updateCell: () => undefined, clearLastAdded: () => undefined }; }\n');
        writeFile(tmpDir, 'src/@/features/orders/components/list/utils/useOrderItemTableDefinition.ts', 'export type OrderItemRow = { id: string; sku: string; name?: string; quantity?: number; unit_price?: number; total?: number; created_at?: string; notes?: string; isNew?: boolean; isModified?: boolean; actions: unknown[]; }; export function useOrderItemTableDefinition() { return []; }\n');

        const filePath = writeFile(
            tmpDir,
            'src/@/features/orders/components/list/OrderListTableComponent.tsx',
            `// Misc
import {
    map,
    filter
}                       from 'lodash';
import {
    useMemo,
    useState
}                       from 'react';
import { FormProvider } from 'react-hook-form';
import type { FC }      from 'react';

// UI
import {
    Input,
    Container,
    DataTable,
    MultiSelect,
    useToast
}                         from '@/components/ui';
import type {
    SelectOption,
    ActionColumnDef
}                         from '@/components/ui';

// @/features
import useOrderItemFormProvider        from '@/features/orders/providers/OrderItemFormProvider';
import { useOrderItemTableDefinition } from './utils/useOrderItemTableDefinition';
import type { OrderItemRow }           from './utils/useOrderItemTableDefinition';
import type OrderItemModel             from '@/features/orders/models/OrderItemModel';

// @/lib
import { useSearch } from '@/lib/search';
import { useTable }  from '@/lib/table';

type RowStatus = 'isModified' | 'isNew' | 'initial';

type Props = {
    onChange: () => void;
};

type Filters = {
    statuses: RowStatus[];
    searchText: string;
};

const StatusOptions: SelectOption<RowStatus>[] = [
    { value: 'isModified', title: 'Modified' },
    { value: 'isNew',      title: 'New' },
    { value: 'initial',    title: 'Initial' }
];

const OrderListTableComponent: FC<Props> = (props) => {
    const { onChange } = props;
    const [filters, setFilters] = useState<Filters>({ searchText: '', statuses: [] });
    const toastContext = useToast();
    const { form, fields, isLoading, lastAddedRowId, addedRowIds, modifiedRowIds, duplicateRow, deleteRows, updateCell, clearLastAdded } = useOrderItemFormProvider();

    const handleDuplicate = (row: OrderItemRow): void => {
        duplicateRow(row.id);
        onChange();
    };

    const handleDelete = (row: OrderItemRow): void => {
        deleteRows([row.id]);
        onChange();
    };

    const handleCellValueChange = (rowIndex: number, field: string, value: unknown): void => {
        updateCell(rowIndex, field as keyof OrderItemModel, value);
        onChange();
        if (lastAddedRowId) clearLastAdded();
    };

    const rowData: OrderItemRow[] = useMemo(() => map(fields, (field) => ({
        ...field,
        isNew: addedRowIds.has(field.id),
        isModified: modifiedRowIds.has(field.id),
        actions: [] as ActionColumnDef<OrderItemRow>[]
    })), [fields, addedRowIds, modifiedRowIds]);

    const rowsByStatus = useMemo(() => {
        if (filters.statuses.length === 0) return rowData;
        return filter(rowData, (row) => {
            if (filters.statuses.includes('isModified') && row.isModified) return true;
            if (filters.statuses.includes('isNew') && row.isNew) return true;
            if (filters.statuses.includes('initial') && !row.isModified && !row.isNew) return true;
            return false;
        });
    }, [rowData, filters.statuses]);

    const filteredList = useSearch({
        searchText: filters.searchText,
        listToSearch: rowsByStatus,
        keysToSearch: ['id', 'sku', 'name'],
        ignoreLocation: true
    });

    const columns = useOrderItemTableDefinition({
        lastAddedRowId,
        onCellValueChange: handleCellValueChange,
        getFieldDefinition: form.getFieldDefinition
    });

    const table = useTable<OrderItemRow>({
        columns,
        data: filteredList,
        getRowId: (row) => row.id,
        enableRowSelection: (row) => row.original.quantity === 1,
        onRowSelectionChange: () => void 0,
        state: {
            rowSelection: {},
            columnPinning: {
                left: ['checked', 'sku', 'name']
            }
        }
    });

    return (
        <FormProvider { ...form }>
            <Container className='flex flex-col gap-4 h-full min-h-0 relative'>
                <Container className='flex items-center mt-4 gap-2'>
                    <Input
                        type='text'
                        value={ filters.searchText }
                        onChange={ (event) => setFilters((prev) => ({ ...prev, searchText: event.target.value })) }
                        className='min-w-[250px]'
                        placeholder='Search...'
                        icon={ { style: 'far', name: 'search', position: 'left' } }
                    />
                    <MultiSelect
                        hasSearch={ false }
                        className='max-w-xs'
                        options={ [] }
                        value={ [] }
                        onChange={ () => void 0 }
                        placeholder='All categories'
                    />
                    <MultiSelect
                        hasSelectAll={ false }
                        hasSearch={ false }
                        className='max-w-xs'
                        options={ StatusOptions }
                        value={ filters.statuses }
                        onChange={ (value) => setFilters((prev) => ({ ...prev, statuses: value ?? [] })) }
                        placeholder='All rows'
                    />
                </Container>
                <Container className='flex flex-col flex-1 min-h-0 mb-4'>
                    <DataTable autoSizeColumns table={ table } className='bg-white' isLoading={ isLoading } height='100%' showCount />
                </Container>
            </Container>
        </FormProvider>
    );
};

export default OrderListTableComponent;
`
        );

        const result = await formatSingleFile(filePath, config, new Map<string, ImportParser>(), tmpDir);
        expect(result.error).toBeUndefined();

        const output = fs.readFileSync(filePath, 'utf8');
        expect(output).toContain("from '@/features/orders/components/list/utils/useOrderItemTableDefinition';");
        expect(output).not.toContain("import { table } from 'console';");
        expect(output).not.toContain("import { i } from 'mathjs';");
        expect(output).not.toContain("import { type } from 'os';");
    });
});
