# TidyJS

**TypeScript/JavaScript import organization for VS Code**

TidyJS automatically organizes, groups, and aligns import declarations with AST-based parsing (oxc-parser) and an IR-based formatting pipeline.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-blue)](https://marketplace.visualstudio.com/items?itemName=Asmir.tidyjs)

## Features

- **Smart Import Separation**: Automatically separates mixed imports like `import React, { useState, type FC } from 'react'` into individual declarations
- **`from` Keyword Alignment**: Aligns `from` keywords across import groups via a two-pass IR pipeline
- **AST-Based Parsing**: Uses oxc-parser (Rust, ESTree-compatible) for fast and reliable analysis
- **Configurable Formatting**: Specifier sorting, trailing commas, max line width, group spacing, newline enforcement
- **Property Sorting**: Manual command to sort destructuring, objects, interfaces, and types; automatic sorting for enums, exports, and class properties
- **Re-export Organization**: Groups, sorts, and aligns re-export statements (`export { ... } from '...'`)
- **Batch Formatting**: Format all files in a folder with progress tracking, safety guards, and detailed reports
- **Path Resolution**: Convert between relative and alias-based paths with tsconfig and custom alias support
- **Ignore Pragma**: Skip files with `// tidyjs-ignore`
- **Auto-Order Resolution**: Resolves group order conflicts automatically
- **Hierarchical Configuration**: `.tidyjsrc` files and VS Code settings with intelligent merging

## Installation

1. Open VS Code (requires **v1.90.0+**)
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for **"TidyJS"**
4. Click **Install**

## Usage

- **Command Palette**: `Ctrl+Shift+P` > "TidyJS: Format Imports"
- **Format on Save**: Enable `editor.formatOnSave` in VS Code settings
- **Create Config**: `Ctrl+Shift+P` > "TidyJS: Create Configuration File"
- **Sort Properties**: Select code, then `Ctrl+Shift+P` > "TidyJS: Sort Properties"
- **Format Folder**: Right-click a folder in the explorer > "TidyJS: Format Folder"

### Supported Files

`.ts`, `.tsx`, `.js`, `.jsx`

## Quick Start

Create a `.tidyjsrc` in your project root:

```json
{
  "groups": [
    { "name": "React", "match": "^react", "order": 1 },
    { "name": "External", "match": "^[^@./]", "order": 2 },
    { "name": "Internal", "match": "^@/", "order": 3 },
    { "name": "Relative", "match": "^\\.", "order": 4 },
    { "name": "Other", "order": 999, "default": true }
  ],
  "format": {
    "singleQuote": true,
    "removeUnusedImports": true
  }
}
```

## Example

**Before:**
```typescript
import { YpTable, YpButton } from 'ds';
import React, { useState, type FC } from 'react';
import { formatDate } from '@library/helpers';
import * as Utils from './utils';
```

**After:**
```typescript
// React
import React        from 'react';
import { useState } from 'react';
import type { FC }  from 'react';

// DS Components
import { YpButton, YpTable } from 'ds';

// @library
import { formatDate } from '@library/helpers';

// Local
import * as Utils from './utils';
```

## Commands

| Command | Description |
|---------|-------------|
| `TidyJS: Format Imports` | Format imports in active file |
| `TidyJS: Create Configuration File` | Create a `.tidyjsrc` configuration file |
| `TidyJS: Sort Properties` | Sort properties in the current selection |
| `TidyJS: Format Folder` | Format all files in a folder |

## Documentation

### Configuration and Options

- [Configuration](./docs/configuration.md) — Complete configuration reference
- [Formatting Options](./docs/formatting-options.md) — Specifier sorting, trailing comma, line width, group spacing, newline handling
- [Path Aliases](./docs/path-aliases.md) — Path resolution and custom aliases
- [Auto-Order System](./docs/auto-order.md) — Automatic group ordering

### Features

- [Import Types](./docs/import-types.md) — Supported import types and mixed import separation
- [Property Sorting](./docs/sort-properties.md) — Manual and automatic property sorting
- [Re-export Organization](./docs/reexport-organizer.md) — Grouping, sorting, and alignment of re-exports
- [Ignore Pragma](./docs/ignore-pragma.md) — Exclude files from formatting
- [Batch Formatting](./docs/batch-formatting.md) — Format all files in a folder

### Internal Pipeline

- [IR Pipeline](./docs/ir-pipeline.md) — Formatting engine architecture

### Help

- [Troubleshooting](./docs/troubleshooting.md) — Common issues and solutions
- [Contributing](./docs/contributing.md) — Development setup and guidelines

## License

[MIT](LICENSE)

## Links

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Asmir.tidyjs)
- [GitHub Repository](https://github.com/asmirbe/tidyjs)
- [Report Issues](https://github.com/asmirbe/tidyjs/issues)
