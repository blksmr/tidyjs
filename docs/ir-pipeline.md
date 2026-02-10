# IR-Based Formatting Pipeline (Intermediate Representation)

## Overview

TidyJS uses an IR-based formatting pipeline to transform parsed imports into formatted text. This architecture replaces the direct approach (string manipulation) with a declarative three-stage model:

```
ParsedImport[]  -->  IR Builder  -->  IRDocument  -->  Two-Pass Printer  -->  String
     (AST)          (builders.ts)      (types.ts)       (printer.ts)        (output)
```

**Relevant files:**

| File | Role |
|------|------|
| `src/ir/types.ts` | IR node definitions |
| `src/ir/builders.ts` | IR tree construction from parsed imports |
| `src/ir/printer.ts` | Two-pass rendering (measure + render) |
| `src/formatter.ts` | Full pipeline orchestration |

---

## IR Types

The IR tree is composed of immutable nodes. Each node has a discriminating `kind` field:

### Primitive Nodes

```typescript
IRText        { kind: 'text', value: string }
IRHardLine    { kind: 'hardLine' }
IRIndent      { kind: 'indent', count: number, content: IRNode }
IRConcat      { kind: 'concat', parts: IRNode[] }
```

- **`IRText`**: Raw text content (import code, comments, etc.)
- **`IRHardLine`**: Unconditional line break
- **`IRIndent`**: Indents its child content by `count` spaces
- **`IRConcat`**: Concatenates a list of nodes

### Alignment Nodes

```typescript
IRAlignAnchor {
    kind: 'alignAnchor',
    groupId: string,
    prefix: IRNode,      // everything before `from`
    suffix: IRNode,      // `from '...';\n`
    idealWidth?: number  // forced width (multiline)
}

IRAlignGroup {
    kind: 'alignGroup',
    groupId: string,
    children: IRNode[]
}
```

- **`IRAlignAnchor`**: Anchor point for `from` keyword alignment. The `prefix` contains everything before `from`, and the `suffix` contains `from 'source';`. The optional `idealWidth` field allows forcing the width for multiline imports.
- **`IRAlignGroup`**: Groups anchors that share the same alignment column. All `IRAlignAnchor` nodes with the same `groupId` are padded to the same column.

### Root Node

```typescript
IRDocument { kind: 'document', children: IRNode[] }
```

The root document contains the ordered list of all groups and their separators.

### Complete Type Tree

```
IRNode = IRText | IRHardLine | IRIndent | IRConcat
       | IRAlignAnchor | IRAlignGroup | IRDocument
```

---

## IR Builder (`builders.ts`)

The builder transforms `ParsedImport[]` into an IR tree. It exposes three levels of construction:

### 1. Primitive Constructors

Utility functions to create IR nodes:

```typescript
text(value)                          // IRText
hardLine()                           // IRHardLine
indent(count, content)               // IRIndent
concat(...parts)                     // IRConcat
alignAnchor(groupId, prefix, suffix) // IRAlignAnchor
alignGroup(groupId, children)        // IRAlignGroup
doc(children)                        // IRDocument
```

### 2. `buildImportNode(imp, config, groupId)` -- single import

Generates an `IRNode` for a single `ParsedImport`. The logic varies by import type:

| Import Type | Produced Node | Alignment |
|-------------|---------------|-----------|
| Side-effect (`import './styles'`) | `IRText` | None (no `from`) |
| Default (`import React from '...'`) | `IRAlignAnchor` | Yes |
| Type default (`import type X from '...'`) | `IRAlignAnchor` | Yes |
| Named single-line (`import { A } from '...'`) | `IRAlignAnchor` | Yes |
| Named multiline | `IRAlignAnchor` with `idealWidth` | Yes (based on longest specifier) |

**Single-line vs multiline decision** for named imports:

- If `maxLineWidth` is configured (> 0): multiline when total width exceeds `maxLineWidth`
- Otherwise: multiline as soon as there is more than one specifier

**Specifier sorting** (via `sortSpecs()`):

- `'length'` (default): sort by string length
- `'alpha'`: case-insensitive alphabetical sort
- `false`: original order preserved

**Example: multiline named import**

For `import { useState, useEffect, useCallback } from 'react'` with `indent: 4`:

```
import {
    useEffect,           // <- specifiers sorted by length
    useState,
    useCallback,
}                        // <- idealWidth = 4 + 11 + 2 = 17
                            (indent + maxSpecLength + adjustment)
```

The `idealWidth` is calculated as follows:
- `indentSize` + length of longest specifier + `adjustment`
- `adjustment` = 2 if the longest specifier is NOT the last one (or if `trailingComma: 'always'`), 1 otherwise

### 3. `buildGroupNode(groupName, imports, config)` -- single group

Produces an `IRAlignGroup` containing:
1. A `// GroupName` comment (`IRText` node)
2. Import nodes separated by `IRHardLine`

All anchors in the group share the same `groupId`, ensuring `from` alignment within the group.

### 4. `buildDocument(groups, config)` -- complete document

Assembles all groups into an `IRDocument`:
- Inserts `1 + blankLinesBetweenGroups` line breaks between each group
- Adds a final line break

**Example IR structure for two groups:**

```
IRDocument
  +-- IRAlignGroup (groupId: "React")
  |     +-- IRText "// React"
  |     +-- IRHardLine
  |     +-- IRAlignAnchor { prefix: "import React ", suffix: "from 'react';" }
  |     +-- IRHardLine
  |     +-- IRAlignAnchor { prefix: "import { useState } ", suffix: "from 'react';" }
  |
  +-- IRHardLine  (separator)
  +-- IRHardLine  (blank line)
  |
  +-- IRAlignGroup (groupId: "Utils")
  |     +-- IRText "// Utils"
  |     +-- IRHardLine
  |     +-- IRAlignAnchor { prefix: "import { helper } ", suffix: "from './utils';" }
  |
  +-- IRHardLine  (final newline)
```

---

## Two-Pass Printer (`printer.ts`)

The printer transforms the IR tree into final text output in two passes.

### Pass 1: Measure (`measure`)

Traverses the IR tree and collects all effective widths of `IRAlignAnchor` nodes:

```
For each IRAlignAnchor:
    effective width = idealWidth ?? measureTextWidth(prefix)

For each groupId:
    resolved column = max(all effective widths in the group)
```

**`measureTextWidth(node)`** computes the width of the last line of a node. This is important for multiline imports where only the last line (the one with `}`) determines the position of `from`.

Example:

```
import {
    useState,
    useCallback,
}                    <- measureTextWidth returns 2 ("} ")
```

The `containsNewline(node)` function detects whether a node contains line breaks to correctly adjust the width calculation via `measureChildren`.

### Pass 2: Render (`render`)

Traverses the IR tree and generates the final text using the resolved columns:

| Node | Rendering |
|------|-----------|
| `IRText` | Raw value |
| `IRHardLine` | `\n` |
| `IRIndent` | `' '.repeat(count)` + rendered content |
| `IRConcat` | Concatenation of rendered parts |
| `IRAlignGroup` | Concatenation of rendered children |
| `IRDocument` | Concatenation of rendered children |
| `IRAlignAnchor` | Padded prefix then suffix (see below) |

**Rendering an `IRAlignAnchor`** -- the key alignment step:

For a **single-line** import:
```
prefix.padEnd(resolvedColumn) + suffix
```

For a **multiline** import:
```
lines[0..n-1] + '\n' + lastLine.padEnd(resolvedColumn) + suffix
```

Padding is applied only to the last line of the prefix (the one containing `}`), thus aligning the `from` keyword with the other imports in the group.

### Full Example

Input (3 imports in the same group):

```typescript
import React from 'react';
import { useState } from 'react';
import { useCallback, useEffect } from 'react';
```

**Pass 1** -- width measurement:

```
"import React "         -> width = 14
"import { useState } "  -> width = 21
"import { useCallback, useEffect } " -> width = 36  (or idealWidth if multiline)

resolved column = max(14, 21, 36) = 36
```

**Pass 2** -- rendering with padding:

```
import React                         from 'react';
import { useState }                  from 'react';
import { useCallback, useEffect }    from 'react';
       ^                              ^
       |                              |
       prefixes padded to 36 chars    from aligned
```

---

## Orchestration (`formatter.ts`)

The `formatter.ts` file orchestrates the complete pipeline:

### `formatImportsFromParser(sourceText, importRange, parserResult, config)`

1. Checks for the presence of imports (removes the section if none)
2. Detects dynamic imports (error if found in the static zone)
3. Sorts groups by `order`
4. Calls `buildDocument(groups, config)` to build the IR
5. Calls `printDocument(irDocument)` to generate the formatted text

### `replaceImportLines(sourceText, importRange, formattedImports, config)`

Replaces the import zone in the source text:
- Handles the `enforceNewlineAfterImports` option (strips or preserves blank lines after imports)
- Handles the case where the file ends with imports
- Ensures a clean transition when all imports are removed

### `formatImports(sourceText, config, parserResult)`

Public entry point. Validates the `parserResult`, handles errors, returns `{ text, error? }`.

---

## `from` Alignment Algorithm -- Summary

```
1. Each non-side-effect import produces an IRAlignAnchor
   with a groupId corresponding to its import group

2. Anchors with the same groupId are grouped into an IRAlignGroup

3. Pass 1 (measure):
   - For each anchor: width = idealWidth || measure of prefix
   - For each groupId: column = max(widths)

4. Pass 2 (render):
   - For each anchor: prefix.padEnd(column) + suffix
   - Groups are independent (each has its own column)
```

Alignment groups are **independent**: each group has its own resolved column. A very long import in one group does not affect the alignment of other groups.

---

## Benefits of the IR Architecture

### Determinism
The pipeline is a pure transformation: same input = same output. No mutable state, no side effects in the IR construction or rendering.

### Separation of Concerns
- The **builder** focuses on logical structure (what to display)
- The **printer** focuses on physical rendering (how to display)
- The **formatter** focuses on integration into the source document

### Extensibility
Adding a new formatting type (e.g., inline comment alignment) amounts to:
1. Adding a new IR node type in `types.ts`
2. Handling its construction in `builders.ts`
3. Handling its rendering in `printer.ts`

The rest of the pipeline is unaffected.

### Testability
Each layer is independently testable:
- Unit tests for builders (verifying the produced IR structure)
- Unit tests for the printer (verifying rendering for known IR trees)
- Integration tests for the complete pipeline (input -> output)

### Multi-Pass Alignment
The two-pass approach allows computing optimal alignment before rendering. The former direct approach required width calculations interleaved with text generation, making the code fragile and difficult to extend.
