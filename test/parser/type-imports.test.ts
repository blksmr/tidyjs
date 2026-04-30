import { ImportParser } from '../../src/parser';
import { formatImports } from '../../src/formatter';
import type { Config as ExtensionGlobalConfig } from '../../src/types';

describe('Type Import Handling', () => {
  let parser: ImportParser;
  let config: ExtensionGlobalConfig;

  beforeEach(() => {
    config = {
      groups: [
        { name: 'Other', order: 0, match: /^react/, default: false },
        { name: '@app/feature', order: 1, match: /^@app\/feature/, default: false },
        { name: '@/lib', order: 2, match: /^@\/lib/, default: false },
        { name: 'UI', order: 3, match: /^@\/components\/ui/, default: false },
        { name: 'Default', order: 999, default: true }
      ],
      importOrder: { sideEffect: 0, default: 1, named: 2, typeOnly: 3 },
      format: { singleQuote: true, indent: 4, removeUnusedImports: false },
      excludedFolders: []
    };
    parser = new ImportParser(config);
  });

  test('should correctly detect and format type-only imports', async () => {
    const code = `import {
    useState,
    useEffect,
    useCallback,
    useRef,
    useMemo
} from 'react';
import { get } from 'lodash';
import { useWrapperContext } from '@/components/ui';
import ItemTypeEnum from '@app/feature/models/enums/ItemTypeEnum';
import useHistoryService from '@app/feature/services/items/HistoryService';
import type {
    DynamicSearchItem,
    DynamicSearchModel
} from '@app/feature/models/items/ItemDynamicSearch';
import { DataModel } from '@/lib/form/models/ProviderModel';
import type {
    CallParams,
    DataProviderReturn
} from '@/lib/form/models/ProviderModel';`;

    const parserResult = parser.parse(code);
    const formatted = await formatImports(code, config, parserResult);

    expect(formatted.error).toBeUndefined();
    expect(formatted.text).toContain('import type {');

    // Check that type imports are properly formatted
    expect(formatted.text).toContain('import type {\n    DynamicSearchItem,\n    DynamicSearchModel\n}');

    // Check that value and type imports from same source are separated
    expect(formatted.text).toContain('import { DataModel }');
    expect(formatted.text).toContain('import type {\n    CallParams,\n    DataProviderReturn\n}');
  });

  test('should consolidate type imports from same source', async () => {
    const code = `import type { TypeA } from './types';
import type { TypeB } from './types';
import { valueA } from './types';
import { valueB } from './types';`;

    const parserResult = parser.parse(code);
    const formatted = await formatImports(code, config, parserResult);

    expect(formatted.error).toBeUndefined();

    // Should consolidate type imports
    expect(formatted.text).toContain('import {\n    valueA,\n    valueB\n}');
    expect(formatted.text).toContain('import type {\n    TypeA,\n    TypeB\n}');

    // Should not have multiple imports from same source
    const importLines = formatted.text.split('\n').filter(line => line.includes("from './types'"));
    expect(importLines).toHaveLength(2); // One for values, one for types
  });

  test('should handle mixed default and type imports', async () => {
    const code = `import React from 'react';
import type { FC } from 'react';
import { useState } from 'react';`;

    const parserResult = parser.parse(code);
    const formatted = await formatImports(code, config, parserResult);

    expect(formatted.error).toBeUndefined();
    expect(formatted.text).toContain('import React');
    expect(formatted.text).toContain('import { useState }');
    expect(formatted.text).toContain('import type { FC }');
  });
});
