# Custom Path Aliases

## What Is Path Resolution?

Path resolution allows TidyJS to automatically convert your imports between relative paths (`./utils/helpers`) and alias-based absolute paths (`@/utils/helpers`).

Without this feature, TidyJS simply organizes your imports as-is. With path resolution enabled, the extension can:

- **`relative` mode**: convert aliased imports (`@/utils/helpers`) to relative paths (`../../utils/helpers`)
- **`absolute` mode**: convert relative imports (`../../utils/helpers`) to aliases (`@/utils/helpers`)

This ensures a consistent import style across your entire project.

## Configuration

Path resolution is configured in the `pathResolution` section of your `.tidyjsrc` or VS Code settings.

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable path resolution |
| `mode` | `'relative' \| 'absolute'` | `'relative'` | Conversion direction |
| `preferredAliases` | `string[]` | `[]` | List of preferred aliases (reserved for future use) |
| `aliases` | `Record<string, string[]>` | - | Custom aliases (glob pattern to paths) |

### Minimal Example

```json
{
  "pathResolution": {
    "enabled": true,
    "mode": "absolute",
    "aliases": {
      "@/*": ["./src/*"]
    }
  }
}
```

## Alias Format

Aliases use a format similar to `tsconfig.json` `paths`:

```
"pattern": ["resolution/path/*"]
```

- The **pattern** (key) is a glob pattern used to match imports. The `*` captures the variable part.
- The **paths** (value) are an array of resolution paths, tried in order. The `*` is replaced by the captured part.

### Pattern Examples

| Pattern | Matches | Does Not Match |
|---------|---------|----------------|
| `@/*` | `@/utils/helpers` | `@company/lib` |
| `@app/*` | `@app/auth/login` | `@/utils` |
| `~/*` | `~/components/Button` | `./components` |
| `@components/*` | `@components/Button` | `@/components/Button` |

### Multiple Paths (Fallback)

You can provide multiple paths for the same pattern. TidyJS tries each path in order and uses the first one that corresponds to an existing file:

```json
{
  "pathResolution": {
    "enabled": true,
    "mode": "relative",
    "aliases": {
      "@/*": ["./src/*", "./lib/*"]
    }
  }
}
```

Here, `@/utils/helpers` will first be looked up in `./src/utils/helpers`, then in `./lib/utils/helpers`.

### Extension Resolution

When checking whether a file exists, TidyJS automatically tries the following extensions:

`.ts`, `.tsx`, `.js`, `.jsx`, `.d.ts`, `.d.cts`, `.d.mts`, `/index.ts`, `/index.tsx`, `/index.js`, `/index.jsx`, `/index.d.ts`, `/index.d.cts`, `/index.d.mts`

You do not need to specify extensions in your aliases.

## Source Priority

TidyJS resolves aliases according to this priority (highest to lowest):

1. **`.tidyjsrc` / `tidyjs.json` aliases**: defined in `pathResolution.aliases`
2. **VS Code aliases**: defined in the `tidyjs.pathResolution.aliases` settings
3. **`tsconfig.json`**: `compilerOptions.paths` section (with `baseUrl`)
4. **`jsconfig.json`**: same format as `tsconfig.json`

If the same pattern is defined in multiple sources, the highest-priority source wins. Patterns from lower-priority sources are only added if they do not already exist in a higher-priority source.

### tsconfig Lookup

TidyJS walks up the directory tree from the file being edited to the workspace root, looking for `tsconfig.json` then `jsconfig.json` in each directory. The first file containing path mappings is used.

If `tsconfig.json` does not contain `paths` but defines a `baseUrl`, TidyJS creates a default mapping `* -> baseUrl/*`.

## Relative Path Resolution in Aliases

Paths in `aliases` are resolved differently depending on the source:

- **`.tidyjsrc` / `tidyjs.json`**: relative paths are resolved relative to the **directory containing the config file**
- **VS Code settings**: relative paths are resolved relative to the **workspace folder** of the document being edited

This ensures correct behavior even in multi-root workspaces.

## Pattern Specificity

When multiple patterns match an import, TidyJS picks the most specific one based on a computed score:

- Number of fixed segments (without wildcards): highest weight
- Total pattern length
- Number of wildcards: fewer wildcards means a more specific pattern

For example, `@app/auth/*` is more specific than `@/*`, so it takes precedence.

## Multi-Root Workspaces

In a VS Code multi-root workspace, path resolution works per workspace folder:

- Mappings are cached per workspace folder
- `tsconfig.json` paths are searched by walking up from the document to its workspace folder root
- VS Code settings aliases are resolved relative to the document's workspace folder

This means each sub-project in a multi-root workspace can have its own path configuration.

## Full Examples

### Simple Project with `@/` Alias

**Structure:**
```
my-project/
  src/
    components/
      Button.tsx
    utils/
      helpers.ts
    pages/
      Home.tsx
  tsconfig.json
  .tidyjsrc
```

**`.tidyjsrc`:**
```json
{
  "groups": [
    { "name": "React", "match": "^react", "order": 0 },
    { "name": "External", "match": "^[^@.]", "order": 1 },
    { "name": "Internal", "match": "^@/", "order": 2 },
    { "name": "Relative", "match": "^\\.", "order": 3, "default": true }
  ],
  "pathResolution": {
    "enabled": true,
    "mode": "absolute",
    "aliases": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Result** in `src/pages/Home.tsx`:
```typescript
// Before
import { Button } from '../components/Button';
import { formatDate } from '../utils/helpers';

// After (absolute mode)
import { Button }     from '@/components/Button';
import { formatDate } from '@/utils/helpers';
```

### Monorepo with Multiple Aliases

**Structure:**
```
monorepo/
  packages/
    app/
      src/
        features/
          auth/
            LoginPage.tsx
    shared/
      src/
        ui/
          Button.tsx
        utils/
          api.ts
  .tidyjsrc
```

**`.tidyjsrc`:**
```json
{
  "groups": [
    { "name": "React", "match": "^react", "order": 0 },
    { "name": "External", "match": "^[^@.]", "order": 1 },
    { "name": "Shared", "match": "^@shared/", "order": 2 },
    { "name": "App", "match": "^@app/", "order": 3 },
    { "name": "Relative", "match": "^\\.", "order": 4, "default": true }
  ],
  "pathResolution": {
    "enabled": true,
    "mode": "absolute",
    "aliases": {
      "@shared/*": ["./packages/shared/src/*"],
      "@app/*": ["./packages/app/src/*"]
    }
  }
}
```

### Migrating from tsconfig Paths

If you already have `paths` in your `tsconfig.json`, you **do not need** to duplicate them in `.tidyjsrc`. TidyJS reads them automatically.

**`tsconfig.json`:**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@utils/*": ["src/utils/*"]
    }
  }
}
```

**Minimal `.tidyjsrc`:**
```json
{
  "pathResolution": {
    "enabled": true,
    "mode": "absolute"
  }
}
```

TidyJS automatically detects the `paths` from `tsconfig.json` and uses them for resolution. No additional aliases are needed.

If you want to **override** a tsconfig alias, add it to `.tidyjsrc` — it takes priority:

```json
{
  "pathResolution": {
    "enabled": true,
    "mode": "absolute",
    "aliases": {
      "@/*": ["./src/*"]
    }
  }
}
```

Here, the `@/*` pattern in `.tidyjsrc` overrides the one from `tsconfig.json`.

### VS Code Configuration (without .tidyjsrc)

In your VS Code `settings.json`:

```json
{
  "tidyjs.pathResolution.enabled": true,
  "tidyjs.pathResolution.mode": "absolute",
  "tidyjs.pathResolution.aliases": {
    "@/*": ["src/*"]
  }
}
```

## Common Use Cases

### Converting a Project to Aliases

1. Add `paths` to your `tsconfig.json` (so TypeScript understands the aliases)
2. Enable resolution in `.tidyjsrc` with `mode: "absolute"`
3. Run TidyJS on your files — relative imports will be converted to aliases

### Converting a Project to Relative Paths

1. Enable resolution in `.tidyjsrc` with `mode: "relative"`
2. Define the aliases used in your code (or let TidyJS read them from `tsconfig.json`)
3. Run TidyJS — aliased imports will be converted to relative paths

### node_modules Protection

In `relative` mode, if an alias resolves to a path inside `node_modules`, TidyJS skips that import. This prevents npm package imports from being transformed into relative paths.

### Alias Validation

In `absolute` mode, TidyJS verifies that the generated alias starts with `@`, `~`, or contains a `/`. This prevents generating invalid aliases that could be mistaken for npm package names.
