# Batch Formatting

The **"TidyJS: Format Folder"** command formats all TypeScript and JavaScript files in a folder in a single operation.

## Launching

### Explorer Context Menu

Right-click a folder in the VS Code explorer and select **"TidyJS: Format Folder"**.

### Command Palette

Open the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and search for **"TidyJS: Format Folder"**.

## Supported Extensions

Only files with the following extensions are processed:
- `.ts`
- `.tsx`
- `.js`
- `.jsx`

## Default Ignored Folders

The following folders are **always** ignored during file discovery, regardless of your configuration:

| Folder | Reason |
|--------|--------|
| `node_modules` | Third-party dependencies |
| `.git` | Git history |
| `dist` | Production build |
| `build` | Production build |
| `out` | Production build |
| `.next` | Next.js build |
| `coverage` | Test coverage reports |
| `.cache` | Miscellaneous caches |
| `.turbo` | Turborepo cache |

### Custom Excluded Folders

In addition to the default ignored folders, you can configure extra folders to exclude:

#### Via `.tidyjsrc` / `tidyjs.json`

```json
{
  "excludedFolders": ["generated", "vendor", "legacy/old-modules"]
}
```

#### Via VS Code Settings

```json
{
  "tidyjs.excludedFolders": ["generated", "vendor"]
}
```

Paths are relative to the workspace root. Files located in these folders (or their subfolders) are skipped with the reason `excluded`.

## Operation Workflow

### 1. File Discovery

TidyJS recursively traverses the selected folder, detects symbolic links to avoid infinite loops, and collects all files with supported extensions.

### 2. Progress Bar

A VS Code progress bar is displayed showing:
- The current file number / total count
- The path of the file currently being processed
- A cancel button to abort the operation

### 3. Per-file Processing

For each file, TidyJS:

1. **Loads the configuration** specific to the file (`.tidyjsrc` from the nearest directory, then workspace, then global)
2. **Checks exclusion** against custom excluded folders
3. **Applies safety guards**: disables `removeUnusedImports` and `removeMissingModules` to prevent destructive changes in batch mode
4. **Formats the file**: imports, enum/export/property sorting, re-export organization
5. **Validates the result**: re-parses the formatted file to ensure it is still syntactically valid
6. **Writes the file** only if changes were made and validation passed

### 4. Final Report

At the end of the operation, a report is displayed with the breakdown:
- **Formatted**: number of files modified
- **Skipped**: number of files skipped (with per-reason detail)
- **Errors**: number of files with errors (with paths and error messages)

## Skip Reasons

When a file is skipped, TidyJS provides the specific reason:

| Reason | Description |
|--------|-------------|
| `empty` | The file is empty or contains only whitespace |
| `ignored` | The file contains the `// tidyjs-ignore` pragma (see [pragma documentation](./ignore-pragma.md)) |
| `no-imports` | The file contains no import declarations |
| `unchanged` | The file contains imports but they are already correctly formatted |
| `excluded` | The file is located in a folder excluded by the `excludedFolders` configuration |

## Safety Guards

Batch formatting automatically disables certain potentially destructive options:

- **`removeUnusedImports: false`**: removing unused imports could break code if static analysis is incomplete
- **`removeMissingModules: false`**: removing missing modules could be due to a different build environment

**Path resolution** is supported in batch mode when a workspace root is available. It uses pure Node.js/fs methods (no VS Code APIs) to resolve paths.

These guards only apply in batch mode. Individual formatting (on save or via command) preserves your settings as-is.

## Post-formatting Validation

Before writing a modified file, TidyJS re-parses the result to verify it is syntactically valid. If validation fails:
- The file is **not modified**
- An error is recorded in the report
- Processing continues with the remaining files

This validation protects against potential formatter regressions.

## Configuration Resolution

Each file can have its own configuration. During batch formatting, TidyJS:

1. **Clears the configuration cache** at the start of the operation
2. **Loads the configuration** specific to each file (walking up the directory tree to find the nearest `.tidyjsrc`)
3. **Reuses parsers** for files sharing the same configuration (performance optimization)

This means that in a monorepo with different `.tidyjsrc` files per sub-project, each file will be formatted according to its own configuration.

## Example Workflow

```
# Formatting a src/ folder containing 150 files

Batch format: discovering files in /project/src
Batch format: found 150 files
  FORMATTED src/components/Button.tsx
  FORMATTED src/components/Modal.tsx
  SKIP [unchanged] src/utils/helpers.ts
  SKIP [no-imports] src/types/index.ts
  SKIP [ignored] src/generated/api.ts
  SKIP [empty] src/placeholder.ts
  ERROR src/broken.ts: Parse error: ...

Batch format complete: 2 formatted, 4 skipped (unchanged: 1, no-imports: 1, ignored: 1, empty: 1), 1 errors
```
