# Re-export Organization

TidyJS can automatically organize your re-exports (`export { ... } from '...'`) using the same grouping, sorting, and alignment rules as for imports.

## Activation

This feature is disabled by default. To enable it:

### Via `.tidyjsrc` / `tidyjs.json`

```json
{
  "format": {
    "organizeReExports": true
  }
}
```

### Via VS Code Settings

```json
{
  "tidyjs.format.organizeReExports": true
}
```

## How It Works

### Block Detection

TidyJS detects **contiguous blocks** of re-exports in your file. A block is a sequence of consecutive re-export lines, interrupted by any other statement (variable, function, standalone comment, etc.).

A block must contain **at least 2 re-exports** to be processed. Isolated re-exports are left as-is.

### Processing

Each detected block goes through the standard IR formatting pipeline:

1. **Extraction**: `ExportNamedDeclaration` AST nodes are converted into `ParsedImport` structures
2. **Grouping**: re-exports are distributed into the groups defined in your configuration (the same groups used for imports)
3. **Sorting**: within each group, value re-exports (`export { x }`) are placed before type re-exports (`export type { T }`), then sorted alphabetically by source
4. **Formatting**: the IR pipeline generates the final output with `from` keyword alignment

### Renamed Specifier Handling

Re-exports with aliases are correctly preserved:

```typescript
export { default as Button } from './button';
export { foo as bar } from './utils';
```

### Type Export Handling

TidyJS distinguishes type re-exports from value re-exports:

```typescript
// Value re-export → ImportType.NAMED
export { Button } from './button';

// Type re-export → ImportType.TYPE_NAMED
export type { ButtonProps } from './button';
```

Value re-exports are always placed before type re-exports within the same group.

## Examples

### Before

```typescript
export { fetchUser } from './api/users';
export type { User } from './api/users';
export { Button } from './components/button';
export { formatDate } from '../utils/date';
export type { Config } from './types';
export { Modal } from './components/modal';
```

### After (with configured groups)

```typescript
export { formatDate } from '../utils/date';

export { Button }       from './components/button';
export { Modal }        from './components/modal';
export { fetchUser }    from './api/users';
export type { Config }  from './types';
export type { User }    from './api/users';
```

Re-exports are grouped according to your configuration groups, sorted within each group, and `from` keywords are aligned.

## Edge Cases

### Parse Errors

If the file contains syntax errors that prevent AST parsing, the original text is returned without modification.

### No Re-exports

If no re-export blocks are detected (or if all blocks contain a single re-export), the text remains unchanged.

### Multiple Blocks

If your file contains multiple re-export blocks separated by other code, each block is processed independently. Replacements are applied from bottom to top to preserve character offsets.

```typescript
// Block 1 — processed independently
export { A } from './a';
export { B } from './b';

const config = {};

// Block 2 — processed independently
export { C } from './c';
export { D } from './d';
```

## Integration with Import Formatting

When `organizeReExports` is enabled, organization happens **after** import formatting. Both operations use the same configuration groups, ensuring visual consistency across your file.

The full processing order is:
1. Import formatting
2. Enum/export/class property sorting (if enabled)
3. Re-export organization
