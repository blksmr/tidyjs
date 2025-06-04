# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# TidyJS - Import Organization VS Code Extension

TidyJS is a VS Code extension that automatically organizes and formats import declarations in TypeScript/JavaScript files. It groups imports by customizable categories, aligns 'from' keywords, and sorts imports by type and length.

## Build/Test/Lint Commands

-   Build: `npm run compile`
-   Watch mode: `npm run watch`
-   Production build: `npm run build-prod`
-   Run all tests: `npm run test:unit`
-   Run specific test: `jest test/parser/file-name.test.ts -t "test description"`
-   Type check: `npm run check-types`
-   Lint: `npm run lint`
-   Fix lint issues: `npm run lint:fix`
-   Package extension: `npm run build` (creates .vsix file)
-   Version bump: `npm run bump:patch` / `bump:minor` / `bump:major`

## Architecture

### Core Components

1. **Parser (`src/parser.ts`)**: Advanced AST-based import analysis with smart separation

    - Uses @typescript-eslint/parser to analyze TypeScript/JavaScript AST
    - **Smart Mixed Import Separation**: Automatically separates mixed imports (e.g., `import React, { useState, type FC } from 'react'` → 3 separate imports)
    - Categorizes imports by type (sideEffect, default, named, typeDefault, typeNamed)
    - Supports all TypeScript import types including namespaces and type imports
    - Groups imports based on regex patterns from configuration
    - Intelligent consolidation of same-type imports from same source

2. **Formatter (`src/formatter.ts`)**: Visual formatting and alignment engine

    - Uses @babel/parser for robust parsing with error recovery
    - Aligns 'from' keywords across import groups with pixel-perfect precision
    - Handles multiline imports and preserves section comments
    - Manages spacing, indentation, and group separation
    - Optimized alignment algorithm for performance

3. **Extension (`src/extension.ts`)**: VS Code integration layer

    - Registers commands and keybindings
    - Handles format-on-save functionality
    - Manages configuration updates and validation
    - Provides error recovery and user notifications
    - **Non-intrusive debug logging** without UI interruption

4. **Configuration (`src/utils/config.ts`)**: ConfigManager with advanced validation
    - **Advanced Cache System**: Smart caching with RegExp serialization support
    - **Robust Validation**: Detects duplicate group orders and names
    - Manages group patterns and import ordering
    - Handles dynamic subfolder detection for @app modules
    - Provides real-time configuration change events with detailed error reporting

### Import Processing Flow

1. **AST Analysis**: Parser extracts all imports from source code using TypeScript AST
2. **Smart Separation**: Mixed imports are intelligently separated by type (value vs type)
3. **Type Categorization**: Each import is categorized (sideEffect, default, named, typeDefault, typeNamed)
4. **Group Matching**: Imports are matched to groups using regex patterns
5. **Consolidation**: Same-type imports from same source are merged and deduplicated
6. **Sorting**: Groups and imports are sorted by configured order and priority
7. **Alignment**: Formatter applies visual alignment and spacing rules
8. **Output**: Extension writes formatted imports back to document

### Smart Import Separation Examples

```typescript
// Input: Mixed import
import React, { useState, type FC } from 'react';

// Parser Output: 3 separate imports
1. Default: React
2. Named: useState  
3. Type Named: FC

// Final Output: 3 properly formatted imports
import React from 'react';
import { useState } from 'react';
import type { FC } from 'react';
```

## Code Style

-   TypeScript with strict typing - explicit return types required
-   Single quotes for strings
-   4-space indentation
-   Semicolons required
-   No `any` types - code must be strongly typed
-   Import sorting hierarchy: sideEffect → default → named → typeOnly (covers typeDefault + typeNamed)
-   React imports always first within their group
-   camelCase for variables and functions
-   Comprehensive error handling with utils/log.ts

## Testing

-   Jest with ts-jest for unit tests
-   Tests located in `test/parser/` directory  
-   Mock VS Code API provided in `test/mocks/vscode.js`
-   Test fixtures in `test/fixtures/` with input/expected pairs
-   Performance benchmarks included for large files
-   **Comprehensive test coverage** for all import types and mixed import scenarios
-   **Bug reproduction tests** to prevent regressions

## Recent Improvements and Bug Fixes

### Major Bug Fixes ✅

1. **Mixed Import Separation**: Fixed critical bug where mixed imports like `import { useState, type FC } from 'react'` were not properly separated
2. **RegExp Cache Serialization**: Fixed cache invalidation bug where RegExp patterns in configuration were serialized as `{}` 
3. **Duplicate Validation**: Fixed broken duplicate detection in configuration validation using `lodash.difference`
4. **UI Interruption**: Fixed debug logging that constantly interrupted users with output panel pop-ups
5. **Namespace Import Handling**: Fixed consolidation issues with mixed default + namespace imports

### New Features 🚀

1. **Smart Import Separation**: Automatic detection and separation of all mixed import combinations
2. **Comprehensive Type Support**: Full support for all TypeScript import types (default, named, namespace, type variants)
3. **Advanced Caching**: Optimized cache system with proper RegExp serialization support
4. **Robust Validation**: Enhanced configuration validation with detailed error reporting
5. **Non-Intrusive Logging**: Debug logging without UI interruption (`preserveFocus: true`)

### Supported Import Types

| Type | Internal | Example | Separation Support |
|------|----------|---------|-------------------|
| Side Effect | `sideEffect` | `import './styles.css';` | ✅ |
| Default | `default` | `import React from 'react';` | ✅ |
| Named | `named` | `import { useState } from 'react';` | ✅ |
| Namespace | `default` | `import * as Utils from './utils';` | ✅ |
| Type Default | `typeDefault` | `import type React from 'react';` | ✅ |
| Type Named | `typeNamed` | `import type { FC } from 'react';` | ✅ |
| Type Namespace | `typeDefault` | `import type * as Types from './types';` | ✅ |
| **Mixed Imports** | **Multiple** | `import React, { useState, type FC } from 'react';` | **✅ NEW** |

### Mixed Import Examples

```typescript
// All these are now properly handled and separated:

// Default + Named
import React, { useState } from 'react';
// → import React from 'react'; + import { useState } from 'react';

// Named + Type Named  
import { useState, type FC } from 'react';
// → import { useState } from 'react'; + import type { FC } from 'react';

// Default + Named + Type Named
import React, { useState, type FC } from 'react';
// → import React from 'react'; + import { useState } from 'react'; + import type { FC } from 'react';

// Default + Namespace
import React, * as ReactDOM from 'react-dom';
// → import React from 'react-dom'; + import * as ReactDOM from 'react-dom';

// Type Default + Type Named
import type React, { FC } from 'react';
// → import type React from 'react'; + import type { FC } from 'react';
```
