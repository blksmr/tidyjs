# Formatting Options

TidyJS provides 5 advanced options to control how your imports are formatted. These options are configurable via the `.tidyjsrc` / `tidyjs.json` file or VS Code settings.

---

## `sortSpecifiers`

Controls the sort order of specifiers (imported names) inside the curly braces `{ }`.

| Value | Behavior |
|-------|----------|
| `'length'` | Sort by name length (shortest to longest). **Default.** |
| `'alpha'` | Alphabetical sort (case-insensitive). |
| `false` | No sorting, original order is preserved. |

### `.tidyjsrc` Configuration

```json
{
  "format": {
    "sortSpecifiers": "alpha"
  }
}
```

### VS Code Configuration (`settings.json`)

```json
{
  "tidyjs.format.sortSpecifiers": "alpha"
}
```

### Examples

**Before** (original order):

```typescript
import { createContext, useState, FC, useEffect } from 'react';
```

**After with `'length'`** (default):

```typescript
import { FC, useState, useEffect, createContext } from 'react';
```

**After with `'alpha'`**:

```typescript
import { createContext, FC, useEffect, useState } from 'react';
```

**After with `false`**:

```typescript
import { createContext, useState, FC, useEffect } from 'react';
```

> Renamed specifiers (`imported as local`) are treated as a single string for length calculation and alphabetical sorting.

---

## `trailingComma`

Controls whether a trailing comma is added after the last specifier in **multiline** imports.

| Value | Behavior |
|-------|----------|
| `'never'` | No trailing comma. **Default.** |
| `'always'` | Trailing comma always added. |

> This option only affects multiline imports. Single-line imports are not affected.

### `.tidyjsrc` Configuration

```json
{
  "format": {
    "trailingComma": "always"
  }
}
```

### VS Code Configuration (`settings.json`)

```json
{
  "tidyjs.format.trailingComma": "always"
}
```

### Examples

**With `'never'`** (default):

```typescript
import {
    useState,
    useEffect,
    useCallback
} from 'react';
```

**With `'always'`**:

```typescript
import {
    useState,
    useEffect,
    useCallback,
} from 'react';
```

---

## `maxLineWidth`

Sets the maximum width of an import line (in characters). When a named import exceeds this width, it is automatically reformatted as multiline.

| Value | Behavior |
|-------|----------|
| `0` | Disabled. Imports with 2+ specifiers are always multiline. **Default.** |
| Positive number | Character threshold. The import stays on a single line if it does not exceed this width. |

### `.tidyjsrc` Configuration

```json
{
  "format": {
    "maxLineWidth": 100
  }
}
```

### VS Code Configuration (`settings.json`)

```json
{
  "tidyjs.format.maxLineWidth": 100
}
```

### Examples

**With `0`** (default) -- any import with 2+ specifiers is multiline:

```typescript
// Single specifier -> always single-line
import { useState } from 'react';

// Two specifiers -> multiline (default behavior)
import {
    useState,
    useEffect
} from 'react';
```

**With `maxLineWidth: 80`** -- the import stays on one line if it fits within 80 characters:

```typescript
// 53 characters -> fits on one line
import { useState, useEffect } from 'react';

// Long import exceeding 80 characters -> multiline
import {
    createContext,
    useCallback,
    useEffect,
    useMemo,
    useState
} from 'react';
```

> The width is calculated on the complete line, including the `import` keyword, braces, spaces, and the `from '...'` path.

---

## `blankLinesBetweenGroups`

Controls the number of blank lines inserted between import groups.

| Value | Behavior |
|-------|----------|
| `1` | One blank line between each group. **Default.** |
| `0` | No blank lines, groups are placed back-to-back. |
| `2`, `3`, ... | That many blank lines between groups. |

### `.tidyjsrc` Configuration

```json
{
  "format": {
    "blankLinesBetweenGroups": 2
  }
}
```

### VS Code Configuration (`settings.json`)

```json
{
  "tidyjs.format.blankLinesBetweenGroups": 2
}
```

### Examples

**With `blankLinesBetweenGroups: 1`** (default):

```typescript
// React
import React from 'react';

// External
import lodash from 'lodash';

// Internal
import { utils } from '@/utils';
```

**With `blankLinesBetweenGroups: 0`**:

```typescript
// React
import React from 'react';
// External
import lodash from 'lodash';
// Internal
import { utils } from '@/utils';
```

**With `blankLinesBetweenGroups: 2`**:

```typescript
// React
import React from 'react';


// External
import lodash from 'lodash';


// Internal
import { utils } from '@/utils';
```

---

## `enforceNewlineAfterImports`

Controls whether TidyJS enforces a blank line between the last import and the code that follows.

| Value | Behavior |
|-------|----------|
| `true` | Enforces a blank line after imports. Existing blank lines between imports and code are cleaned up and replaced with exactly one. **Default.** |
| `false` | Preserves the original spacing between imports and the following code. |

### `.tidyjsrc` Configuration

```json
{
  "format": {
    "enforceNewlineAfterImports": false
  }
}
```

### VS Code Configuration (`settings.json`)

```json
{
  "tidyjs.format.enforceNewlineAfterImports": false
}
```

### Examples

**With `true`** (default):

```typescript
import React        from 'react';
import { useState } from 'react';

const App = () => { ... };
```

Even if the original file had 3 blank lines or no blank lines between imports and code, TidyJS normalizes to exactly one blank line.

**With `false`**:

```typescript
// If the original file had 0 blank lines, they are preserved:
import React        from 'react';
import { useState } from 'react';
const App = () => { ... };

// If the original file had 3 blank lines, they are preserved:
import React        from 'react';
import { useState } from 'react';



const App = () => { ... };
```

---

## Combined Configuration

Here is a complete example using all formatting options:

### `.tidyjsrc`

```json
{
  "groups": [
    { "name": "React", "match": "^react", "order": 0 },
    { "name": "External", "match": "^[^@.]", "order": 1 },
    { "name": "Internal", "match": "^@/", "order": 2 },
    { "name": "Relative", "match": "^\\.", "order": 3, "default": true }
  ],
  "format": {
    "sortSpecifiers": "alpha",
    "trailingComma": "always",
    "maxLineWidth": 100,
    "blankLinesBetweenGroups": 1,
    "enforceNewlineAfterImports": true
  }
}
```

### VS Code `settings.json`

```json
{
  "tidyjs.format.sortSpecifiers": "alpha",
  "tidyjs.format.trailingComma": "always",
  "tidyjs.format.maxLineWidth": 100,
  "tidyjs.format.blankLinesBetweenGroups": 1,
  "tidyjs.format.enforceNewlineAfterImports": true
}
```

### Result

```typescript
// React
import React                                  from 'react';
import { useCallback, useEffect, useState }   from 'react';

// External
import axios   from 'axios';
import lodash  from 'lodash';

// Internal
import { apiClient }  from '@/api';
import { logger }     from '@/utils';

// Relative
import { helper } from './helper';

const App = () => { ... };
```
