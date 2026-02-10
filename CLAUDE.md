# TidyJS - Import Organization VS Code Extension

VS Code extension that organizes and formats TypeScript/JavaScript import declarations. Groups by customizable categories, aligns `from` keywords, sorts by type and length.

## Commands

- `npm run test` — Jest tests
- `npm run test:e2e` — build + VS Code extension tests
- `tsc --noEmit` — type check
- `npm run lint` — ESLint (src, test/parser, jest.config.cjs)
- `npm run check` — type check + lint + tests
- `npm run dev` — watch (esbuild + tsc)
- `npm run build` — production build + .vsix
- `npm run bump` — version bump (bump.sh)

## Architecture

- **Parser (`src/parser.ts`)**: AST-based import analysis (oxc-parser). Separates mixed imports (e.g. `import React, { useState, type FC } from 'react'` → 3 imports). Categorizes: sideEffect, default, named, typeDefault, typeNamed. Groups via regex patterns. Consolidates same-type/same-source imports. Wrapper: `src/utils/oxc-parse.ts`. Types: `src/types/ast.ts`.
- **Formatter (`src/formatter.ts`)**: IR-based formatting pipeline. Aligns `from` keywords, handles multiline, preserves comments. Pipeline: `ParsedImport[] → IR Builder → IRDocument → Two-Pass Printer → String`. IR files: `src/ir/types.ts`, `src/ir/builders.ts`, `src/ir/printer.ts`.
- **Extension (`src/extension.ts`)**: VS Code integration — commands, keybindings, format-on-save, config updates, non-intrusive debug logging.
- **Configuration (`src/utils/config.ts`)**: ConfigManager with RegExp-aware cache, validation (duplicate orders/names), regex group patterns, @app subfolder detection.
- **Path Resolver (`src/utils/path-resolver.ts`)**: Converts import paths between relative and alias forms. VS Code API methods for single-file mode, pure Node.js/fs batch methods (`convertImportPathBatch`, `loadPathMappingsBatch`, etc.) for folder-wide formatting. Reads tsconfig/jsconfig path mappings.
- **Batch Formatter (`src/batch-formatter.ts`)**: Folder-wide formatting with file discovery, safety guards, and path resolution support. `formatSingleFile` accepts optional `workspaceRoot` to enable batch path resolution.

### Processing Flow

AST Analysis → Mixed Import Separation → Type Categorization → Group Matching (regex) → Consolidation → Path Resolution (if enabled) → Sorting → Alignment → Output

### Import Types

sideEffect (`import './styles.css'`), default (`import React from 'react'`), named (`import { useState } from 'react'`), namespace (`import * as Utils from './utils'` — typed as default), typeDefault (`import type React from 'react'`), typeNamed (`import type { FC } from 'react'`). Mixed imports are auto-separated into these types.

## Code Style

- TypeScript strict — explicit return types, no `any`
- Single quotes, 4-space indent, semicolons
- camelCase for variables/functions
- Sort hierarchy: sideEffect → default → named → typeOnly
- React imports first within their group
- Error handling via `utils/log.ts`

## Testing

- Jest + ts-jest, tests in `test/parser/`, `test/ir/`, `test/unit/`, `test/configLoader/`, `test/path-resolver/`
- VS Code mock: `test/mocks/vscode.cjs`
- oxc-parser mock: `test/mocks/oxc-parser.cjs`
- Fixtures: `test/fixtures/` (input/expected pairs)
- Every feature must have tests. Bug reproduction tests for regressions.

## Configuration

Priority (highest → lowest): `.tidyjsrc`/`tidyjs.json` in same dir → parent dirs → VS Code workspace → VS Code global → defaults. `.tidyjsrc` takes precedence over `tidyjs.json`.

**Auto-Order Resolution**: Duplicate orders auto-pushed to next slot. Missing orders auto-assigned sequentially from 0. Invalid values (negative, decimal, string) treated as missing.

Example `.tidyjsrc`:
```json
{
  "groups": [
    { "name": "React", "match": "^react", "order": 1 },
    { "name": "External", "match": "^[^@.]", "order": 2 },
    { "name": "Internal", "match": "^@/", "order": 3 },
    { "name": "Relative", "match": "^\\.", "order": 4 }
  ],
  "format": { "indent": 4, "singleQuote": true, "bracketSpacing": true, "removeUnusedImports": false }
}
```

## Development Process

Features implemented atomically, progressively, always with tests. Manual extension testing mandatory after each implementation.
