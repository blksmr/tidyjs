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

describe('Yeap import corruption regression', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tidyjs-yeap-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('keeps the copied BulletinSaisieCotisationTableComponent valid after formatting', async () => {
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
                    match: /^(react|react-.*|lodash|date-fns|uuid|@tanstack|@fortawesome|@auth0|@datadog|@radix-ui|@popperjs|nuqs|fast-json-patch|jwt-decode|crypto-js|deep-object-diff|microdiff|fuse\.js|framer-motion|ag-grid-community|ag-grid-enterprise|ag-grid-react)(\/|$)/,
                },
                { name: 'DS', order: 2, match: /^ds$/ },
                { name: '@app/dossier', order: 3, match: /^@app\/dossier/ },
                { name: '@library', order: 4, match: /^@library/ },
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

        writeFile(tmpDir, 'src/@library/utils/search.ts', 'export const useSearch = () => [] as unknown[];\n');
        writeFile(tmpDir, 'src/@library/utils/table.ts', 'export const useTable = <T,>(value: T) => value;\n');
        writeFile(tmpDir, 'src/@app/dossier/models/BulletinCotisationFormModel.ts', 'export default interface BulletinCotisationFormModel { id: string; type: number; code: string; libelle: string; base: number; taux_salarial: number; montant_salarial: number; taux_patronal: number; montant_patronal: number; date_debut: string; date_fin: string; commentaire: string; }\n');
        writeFile(tmpDir, 'src/@app/dossier/providers/bulletins/BulletinCotisationFormProvider.ts', 'export default function useBulletinCotisationFormProvider() { return { form: { getFieldDefinition: () => null }, fields: [], isLoading: false, lastAddedRowId: undefined, addedRowIds: new Set<string>(), modifiedRowIds: new Set<string>(), duplicateRow: () => undefined, deleteRows: () => undefined, updateCell: () => undefined, clearLastAdded: () => undefined }; }\n');
        writeFile(tmpDir, 'src/@app/dossier/components/bulletins/regulariser/utils/useBulletinCotisationTableDefinition.ts', 'export type TBulletinCotisationRow = { id: string; type: number; code?: string; libelle?: string; base?: number; taux_salarial?: number; montant_salarial?: number; taux_patronal?: number; montant_patronal?: number; date_debut?: string; date_fin?: string; commentaire?: string; isNew?: boolean; isModified?: boolean; actions: unknown[]; }; export function useBulletinCotisationTableDefinition() { return []; }\n');

        const filePath = writeFile(
            tmpDir,
            'src/@app/dossier/components/bulletins/regulariser/BulletinSaisieCotisationTableComponent.tsx',
            `// Misc
import {
    map,
    filter
}                       from 'lodash';
import {
    useMemo,
    useState
}                       from 'react';
import { FormProvider } from 'react-hook-form-new';
import type { FC }      from 'react';

// DS
import {
    YpInput,
    YpElement,
    YpDataTable,
    YpMultiSelect,
    useToastContext
}                         from 'ds';
import type {
    TYpSelectOption,
    ActionColumnActionDef
}                         from 'ds';

// @app/dossier
import useBulletinCotisationFormProvider        from '@app/dossier/providers/bulletins/BulletinCotisationFormProvider';
import { useBulletinCotisationTableDefinition } from './utils/useBulletinCotisationTableDefinition';
import type { TBulletinCotisationRow }          from './utils/useBulletinCotisationTableDefinition';
import type BulletinCotisationFormModel         from '@app/dossier/models/BulletinCotisationFormModel';

// @library
import { useSearch } from '@library/utils/search';
import { useTable }  from '@library/utils/table';

type TStatutLigne = 'isModified' | 'isNew' | 'initial';

type TProps = {
    onModification: () => void;
};

type TFilters = {
    statuts: TStatutLigne[];
    searchText: string;
};

const StatutsLignesOptions: TYpSelectOption<TStatutLigne>[] = [
    { value: 'isModified', title: 'Modifié' },
    { value: 'isNew',      title: 'Ajouté' },
    { value: 'initial',    title: 'Initial' }
];

const BulletinSaisieCotisationTableComponent: FC<TProps> = (props) => {
    const { onModification } = props;
    const [filters, setFilters] = useState<TFilters>({ searchText: '', statuts: [] });
    const toastContext = useToastContext();
    const { form, fields, isLoading, lastAddedRowId, addedRowIds, modifiedRowIds, duplicateRow, deleteRows, updateCell, clearLastAdded } = useBulletinCotisationFormProvider();

    const handleDuplicate = (row: TBulletinCotisationRow): void => {
        duplicateRow(row.id);
        onModification();
    };

    const handleDelete = (row: TBulletinCotisationRow): void => {
        deleteRows([row.id]);
        onModification();
    };

    const handleCellValueChange = (rowIndex: number, field: string, value: unknown): void => {
        updateCell(rowIndex, field as keyof BulletinCotisationFormModel, value);
        onModification();
        if (lastAddedRowId) clearLastAdded();
    };

    const rowData: TBulletinCotisationRow[] = useMemo(() => map(fields, (field) => ({
        ...field,
        isNew: addedRowIds.has(field.id),
        isModified: modifiedRowIds.has(field.id),
        actions: [] as ActionColumnActionDef<TBulletinCotisationRow>[]
    })), [fields, addedRowIds, modifiedRowIds]);

    const rowsByStatus = useMemo(() => {
        if (filters.statuts.length === 0) return rowData;
        return filter(rowData, (row) => {
            if (filters.statuts.includes('isModified') && row.isModified) return true;
            if (filters.statuts.includes('isNew') && row.isNew) return true;
            if (filters.statuts.includes('initial') && !row.isModified && !row.isNew) return true;
            return false;
        });
    }, [rowData, filters.statuts]);

    const filteredList = useSearch({
        searchText: filters.searchText,
        listToSearch: rowsByStatus,
        keysToSearch: ['id', 'code', 'libelle'],
        ignoreLocation: true
    });

    const columns = useBulletinCotisationTableDefinition({
        lastAddedRowId,
        onCellValueChange: handleCellValueChange,
        getFieldDefinition: form.getFieldDefinition
    });

    const table = useTable<TBulletinCotisationRow>({
        columns,
        data: filteredList,
        getRowId: (row) => row.id,
        enableRowSelection: (row) => row.original.type === 1,
        onRowSelectionChange: () => void 0,
        state: {
            rowSelection: {},
            columnPinning: {
                left: ['checked', 'code', 'libelle']
            }
        }
    });

    return (
        <FormProvider { ...form }>
            <YpElement className='flex flex-col gap-4 h-full min-h-0 relative'>
                <YpElement className='flex items-center mt-4 gap-2'>
                    <YpInput
                        type='text'
                        value={ filters.searchText }
                        onChange={ (event) => setFilters((prev) => ({ ...prev, searchText: event.target.value })) }
                        className='min-w-[250px]'
                        placeholder='Rechercher ...'
                        icon={ { style: 'far', name: 'search', position: 'left' } }
                    />
                    <YpMultiSelect
                        hasSearch={ false }
                        className='max-w-xs'
                        options={ [] }
                        value={ [] }
                        onChange={ () => void 0 }
                        placeholder='Toutes les rubriques'
                    />
                    <YpMultiSelect
                        hasSelectAll={ false }
                        hasSearch={ false }
                        className='max-w-xs'
                        options={ StatutsLignesOptions }
                        value={ filters.statuts }
                        onChange={ (value) => setFilters((prev) => ({ ...prev, statuts: value ?? [] })) }
                        placeholder='Toutes les lignes'
                    />
                </YpElement>
                <YpElement className='flex flex-col flex-1 min-h-0 mb-4'>
                    <YpDataTable autoSizeColumns table={ table } className='bg-white' isLoading={ isLoading } height='100%' showCount />
                </YpElement>
            </YpElement>
        </FormProvider>
    );
};

export default BulletinSaisieCotisationTableComponent;
`
        );

        const result = await formatSingleFile(filePath, config, new Map<string, ImportParser>(), tmpDir);
        expect(result.error).toBeUndefined();

        const output = fs.readFileSync(filePath, 'utf8');
        expect(output).toContain("from '@app/dossier/components/bulletins/regulariser/utils/useBulletinCotisationTableDefinition';");
        expect(output).not.toContain("import { table } from 'console';");
        expect(output).not.toContain("import { i } from 'mathjs';");
        expect(output).not.toContain("import { type } from 'os';");
    });
});
