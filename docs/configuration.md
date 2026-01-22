# Configuration

TidyJS provides a flexible configuration system with multiple levels of precedence.

## Configuration Hierarchy

Configuration is resolved in the following order (highest to lowest priority):

1. **`.tidyjsrc`** - Project-specific JSON configuration (recommended)
2. **`tidyjs.json`** - Alternative project configuration
3. **VS Code Workspace Settings** - Workspace-level configuration
4. **VS Code Global Settings** - User-level configuration
5. **Default Configuration** - Built-in sensible defaults

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
    "sideEffect": 3,
    "default": 0,
    "named": 1,
    "typeOnly": 2
  },
  "tidyjs.format": {
    "indent": 4,
    "removeUnusedImports": false,
    "removeMissingModules": false,
    "singleQuote": true,
    "bracketSpacing": true
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

### Basic Setup

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
      "priority": true,
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
| `name` | `string` | Yes | Display name for the group (used in comments) |
| `match` | `string` | No | Regex pattern to match import paths |
| `order` | `number` | No | Sort order (auto-assigned if missing) |
| `default` | `boolean` | No | Default group for unmatched imports (exactly one required) |
| `priority` | `boolean` | No | Higher priority within the same order |
| `sortOrder` | `"alphabetic"` or `string[]` | No | Custom sorting within the group |

## Import Order Configuration

Control the order of different import types within each group:

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

## Format Options

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

## Path Resolution

Convert between relative and absolute paths:

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
import { Button } from '@components/ui/Button';
import { formatDate } from '@utils/date';
```

## Project Configuration Files

### .tidyjsrc (Recommended)

Create a `.tidyjsrc` file in your project root:

**Quick Setup**: Use the command palette (`Ctrl+Shift+P`) and select "TidyJS: Create Configuration File".

**Manual Setup**:

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
    "removeUnusedImports": true
  }
}
```

### Config Extends Support

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

## Excluded Folders

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

## Debug Mode

Enable comprehensive logging for troubleshooting:

```json
{
  "tidyjs.debug": true
}
```

Check the VS Code Output panel (View > Output > TidyJS) for validation messages.
