# Configuration

TidyJS offers a flexible configuration system with multiple priority levels.

## Configuration Hierarchy

Configuration is resolved in the following order (highest to lowest priority):

1. **`.tidyjsrc`** — Project-specific JSON configuration (recommended)
2. **`tidyjs.json`** — Alternative project configuration
3. **VS Code Workspace Settings** — Workspace-level configuration
4. **VS Code Global Settings** — User-level configuration
5. **Default Configuration** — Built-in default values

## Default Configuration

```json
{
  "tidyjs.debug": false,
  "tidyjs.groups": [
    {
      "name": "Other",
      "order": 0,
      "default": true
    }
  ],
  "tidyjs.importOrder": {
    "sideEffect": 0,
    "default": 1,
    "named": 2,
    "typeOnly": 3
  },
  "tidyjs.format": {
    "indent": 4,
    "removeUnusedImports": false,
    "removeMissingModules": false,
    "singleQuote": true,
    "bracketSpacing": true,
    "organizeReExports": false,
    "enforceNewlineAfterImports": true,
    "blankLinesBetweenGroups": 1,
    "trailingComma": "never",
    "sortSpecifiers": "length",
    "maxLineWidth": 0,
    "sortEnumMembers": false,
    "sortExports": false,
    "sortClassProperties": false
  },
  "tidyjs.pathResolution": {
    "enabled": false,
    "mode": "relative",
    "preferredAliases": []
  },
  "tidyjs.excludedFolders": []
}
```

## Group Configuration

### Basic Configuration

```json
{
  "tidyjs.groups": [
    {
      "name": "React",
      "match": "/^(react|react-dom|next)$/",
      "order": 1
    },
    {
      "name": "External Libraries",
      "match": "/^[^@.]/",
      "order": 2
    },
    {
      "name": "Internal",
      "match": "/^@app/",
      "order": 3
    },
    {
      "name": "Relative",
      "match": "/^\\./",
      "order": 4
    },
    {
      "name": "Other",
      "order": 5,
      "default": true
    }
  ]
}
```

### Advanced Patterns

```json
{
  "tidyjs.groups": [
    {
      "name": "React Ecosystem",
      "match": "/^(react|react-dom|react-router|next|gatsby)/",
      "order": 1,
      "priority": 1,
      "sortOrder": ["react", "react-dom", "react-*", "*"]
    },
    {
      "name": "UI Libraries",
      "match": "/^(@mui|@mantine|antd|semantic-ui)/",
      "order": 2,
      "sortOrder": "alphabetic"
    },
    {
      "name": "State Management",
      "match": "/^(redux|@reduxjs|zustand|recoil|jotai)/",
      "order": 3
    },
    {
      "name": "Utilities",
      "match": "/^(lodash|ramda|date-fns|moment)/",
      "order": 4
    }
  ]
}
```

### Group Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Group name (used in comments) |
| `match` | `string` | No | Regex pattern to match import paths |
| `order` | `number` | No | Sort order (auto-assigned if missing) |
| `default` | `boolean` | No | Default group for unmatched imports (exactly one required) |
| `priority` | `number` | No | Higher priority wins when multiple groups match (0 = default) |
| `sortOrder` | `"alphabetic"` or `string[]` | No | Custom sorting within the group |

## Import Order

Controls the ordering of different import types within each group:

```json
{
  "tidyjs.importOrder": {
    "sideEffect": 0,
    "default": 1,
    "named": 2,
    "typeOnly": 3
  }
}
```

## Formatting Options

### Basic Options

```json
{
  "tidyjs.format": {
    "indent": 4,
    "singleQuote": true,
    "bracketSpacing": true,
    "removeUnusedImports": false,
    "removeMissingModules": false
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `indent` | `number` | `4` | Number of spaces for multiline import indentation |
| `singleQuote` | `boolean` | `true` | Use single quotes (`'`) instead of double quotes (`"`) |
| `bracketSpacing` | `boolean` | `true` | Spaces around braces (`{ useState }` vs `{useState}`) |
| `removeUnusedImports` | `boolean` | `false` | Automatically remove unused imports |
| `removeMissingModules` | `boolean` | `false` | Remove imports from non-existent modules |

### Specifier Sorting

Controls how specifiers are sorted inside import braces.

```json
{
  "tidyjs.format": {
    "sortSpecifiers": "length"
  }
}
```

| Value | Description |
|-------|-------------|
| `"length"` | Sort by name length (default) |
| `"alpha"` | Sort alphabetically |
| `false` | No sorting (original order preserved) |

**Example with `"length"`:**
```typescript
import { FC, useState, useEffect, ComponentProps } from 'react';
```

**Example with `"alpha"`:**
```typescript
import { ComponentProps, FC, useEffect, useState } from 'react';
```

### Trailing Comma

Controls whether a trailing comma is added after the last specifier in multiline imports.

```json
{
  "tidyjs.format": {
    "trailingComma": "never"
  }
}
```

| Value | Description |
|-------|-------------|
| `"never"` | No trailing comma (default) |
| `"always"` | Always add a trailing comma (multiline imports only) |

**Example with `"always"`:**
```typescript
import {
    useState,
    useEffect,
    useCallback,
} from 'react';
```

### Maximum Line Width

Forces multiline mode when an import exceeds the configured width.

```json
{
  "tidyjs.format": {
    "maxLineWidth": 80
  }
}
```

| Value | Description |
|-------|-------------|
| `0` | Disabled (default) — multiline follows standard logic |
| `number` | Maximum character width before switching to multiline |

### Blank Lines Between Groups

Number of blank lines inserted between each import group.

```json
{
  "tidyjs.format": {
    "blankLinesBetweenGroups": 1
  }
}
```

| Value | Description |
|-------|-------------|
| `1` | One blank line between groups (default) |
| `0` | No blank lines |
| `n` | `n` blank lines between groups |

### Newline After Imports

Controls whether a blank line is inserted after the last import block.

```json
{
  "tidyjs.format": {
    "enforceNewlineAfterImports": true
  }
}
```

| Value | Description |
|-------|-------------|
| `true` | Insert a blank line after imports (default) |
| `false` | No forced blank line after imports |

## Automatic Code Sorting

TidyJS can automatically sort certain code structures in addition to imports.

### Enum Member Sorting

Sorts TypeScript enum members by name length (shortest first).

```json
{
  "tidyjs.format": {
    "sortEnumMembers": true
  }
}
```

**Before:**
```typescript
enum Status {
    InProgress = 'in_progress',
    OK = 'ok',
    Error = 'error',
}
```

**After:**
```typescript
enum Status {
    OK = 'ok',
    Error = 'error',
    InProgress = 'in_progress',
}
```

### Export Sorting

Sorts multiline export specifiers by exported name length (shortest first).

```json
{
  "tidyjs.format": {
    "sortExports": true
  }
}
```

### Class Property Sorting

Sorts instance properties within class bodies by name length (shortest first). Static properties and methods are not affected.

```json
{
  "tidyjs.format": {
    "sortClassProperties": true
  }
}
```

### Re-export Organization

Reorganizes and sorts re-exports (`export { ... } from '...'`).

```json
{
  "tidyjs.format": {
    "organizeReExports": true
  }
}
```

**Before:**
```typescript
export { formatDate } from './utils/date';
export { Button } from './components/Button';
export { Modal } from './components/Modal';
```

**After:**
```typescript
export { Button }     from './components/Button';
export { Modal }      from './components/Modal';
export { formatDate } from './utils/date';
```

## Path Resolution

Converts between relative and absolute paths, with support for custom aliases.

### Basic Configuration

```json
{
  "tidyjs.pathResolution": {
    "enabled": true,
    "mode": "absolute",
    "preferredAliases": ["@components", "@utils", "@lib"]
  }
}
```

**Before:**
```typescript
import { Button } from '../../../components/ui/Button';
import { formatDate } from '../../utils/date';
```

**After:**
```typescript
import { Button }     from '@components/ui/Button';
import { formatDate } from '@utils/date';
```

### Custom Aliases

Define alias-to-path mappings for your project:

```json
{
  "tidyjs.pathResolution": {
    "enabled": true,
    "mode": "absolute",
    "aliases": {
      "@components/*": ["./src/components/*"],
      "@utils/*": ["./src/utils/*"],
      "@lib/*": ["./src/lib/*"]
    }
  }
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable path resolution |
| `mode` | `"relative"` or `"absolute"` | `"relative"` | Path conversion mode |
| `preferredAliases` | `string[]` | `[]` | Preferred aliases for conversion |
| `aliases` | `Record<string, string[]>` | — | Custom alias-to-path mappings |

## Excluded Folders

Exclude specific folders from TidyJS processing (useful for batch formatting):

```json
{
  "tidyjs.excludedFolders": [
    "node_modules",
    "dist",
    "build",
    "coverage"
  ]
}
```

## Project Configuration Files

### .tidyjsrc (recommended)

Create a `.tidyjsrc` file at the root of your project:

**Quick setup**: Use the Command Palette (`Ctrl+Shift+P`) and select "TidyJS: Create Configuration File".

**Manual setup**:

```json
{
  "$schema": "./node_modules/tidyjs/tidyjs.schema.json",
  "groups": [
    { "name": "React", "match": "^react", "order": 1 },
    { "name": "External", "match": "^[^@./]", "order": 2 },
    { "name": "Internal", "match": "^@/", "order": 3 },
    { "name": "Relative", "match": "^\\.", "order": 4 },
    { "name": "Other", "order": 999, "default": true }
  ],
  "format": {
    "indent": 2,
    "singleQuote": true,
    "removeUnusedImports": true,
    "sortSpecifiers": "alpha",
    "trailingComma": "always",
    "maxLineWidth": 100,
    "blankLinesBetweenGroups": 1
  }
}
```

### Inheritance Support (extends)

```json
{
  "extends": "./base-config.json",
  "groups": [
    {
      "name": "Project Specific",
      "match": "^@myproject/",
      "order": 1
    }
  ]
}
```

## Debug Mode

Enable logging for troubleshooting:

```json
{
  "tidyjs.debug": true
}
```

Check the VS Code Output panel (View > Output > TidyJS) for validation messages.

## Complete Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `debug` | `boolean` | `false` | Enable debug logging |
| `groups` | `array` | `[{name:"Other",order:0,default:true}]` | Import classification groups |
| `importOrder` | `object` | `{sideEffect:0,default:1,named:2,typeOnly:3}` | Import type ordering |
| `format.indent` | `number` | `4` | Indentation spaces |
| `format.singleQuote` | `boolean` | `true` | Single quotes |
| `format.bracketSpacing` | `boolean` | `true` | Spaces inside braces |
| `format.removeUnusedImports` | `boolean` | `false` | Remove unused imports |
| `format.removeMissingModules` | `boolean` | `false` | Remove imports from missing modules |
| `format.sortSpecifiers` | `"length"` / `"alpha"` / `false` | `"length"` | Specifier sorting |
| `format.trailingComma` | `"always"` / `"never"` | `"never"` | Trailing comma (multiline) |
| `format.maxLineWidth` | `number` | `0` | Max width before multiline (0 = disabled) |
| `format.blankLinesBetweenGroups` | `number` | `1` | Blank lines between groups |
| `format.enforceNewlineAfterImports` | `boolean` | `true` | Blank line after imports |
| `format.sortEnumMembers` | `boolean` | `false` | Sort enum members |
| `format.sortExports` | `boolean` | `false` | Sort exports |
| `format.sortClassProperties` | `boolean` | `false` | Sort class properties |
| `format.organizeReExports` | `boolean` | `false` | Organize re-exports |
| `pathResolution.enabled` | `boolean` | `false` | Enable path resolution |
| `pathResolution.mode` | `"relative"` / `"absolute"` | `"relative"` | Resolution mode |
| `pathResolution.preferredAliases` | `string[]` | `[]` | Preferred aliases |
| `pathResolution.aliases` | `Record<string, string[]>` | — | Custom alias mappings |
| `excludedFolders` | `string[]` | `[]` | Folders excluded from processing |
