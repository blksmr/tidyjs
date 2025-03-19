<div align="center"><img src="./media/icon2.png" width="120" alt="Yeap Theme Logo" />
  <h1 align="center">Yeap Theme</h1>
  <p align="center">An official Yeap theme for Visual Studio Code.</p>
</div>

TidyImport is a VSCode extension that automatically organizes and formats import declarations in TypeScript and JavaScript files. It groups imports by customizable categories, perfectly aligns 'from' keywords, and intelligently sorts imports by type and length.

## Features

- Group imports by configurable categories
- Align 'from' keywords for improved readability
- Sort imports by type hierarchy (side-effects, default, named, type)
- Handle React imports with special priority
- Dynamically create groups based on import paths
- Support for TypeScript, JavaScript, TSX and JSX files
- Configurable spacing and maximum line length

## Example

Before:
```typescript
import { YpTable, YpDivider, YpTypography, YpElement, YpTag, YpButton } from 'ds';
import React, { FC, useState } from 'react';
import cn from 'classnames';
import type { User } from '@app/dossier/models';
import { formatDate } from '@library/helpers';
import { useTranslation } from '@core/i18n';
```

After:
```typescript
// Misc
import React, { FC, useState } from 'react';
import cn                      from 'classnames';

// DS
import {
    YpButton,
    YpDivider,
    YpElement,
    YpTag,
    YpTable,
    YpTypography
} from 'ds';

// @app/dossier
import type { User } from '@app/dossier/models';

// @core
import { useTranslation } from '@core/i18n';

// @library
import { formatDate } from '@library/helpers';
```

## Configuration

```json
"tidyimport.groups": [
  {
    "name": "Misc",
    "regex": "^(react|lodash|date-fns)$",
    "order": 0
  },
  {
    "name": "DS",
    "regex": "^ds$",
    "order": 1
  },
  {
    "name": "@app/dossier",
    "regex": "^@app\\/dossier",
    "order": 2
  },
  // other groups...
],
"tidyimport.alignmentSpacing": 0,
"tidyimport.formatOnSave": false,
"tidyimport.maxLineLength": 150
```

## Usage

- Use VSCode's "Format Document" command (Alt+Shift+F)
- Use the keyboard shortcut Ctrl+Shift+I (Cmd+Shift+I on macOS)
- Or use the "Format Imports" command from the command palette

## Import Sorting Rules

TidyImport sorts imports according to the following hierarchy:
1. React imports always come first within their group
2. Side-effect imports (e.g., `import 'module'`)
3. Default non-type imports
4. Named non-type imports
5. Default type imports
6. Named type imports

Within each category, imports are sorted alphabetically.

## Known Issues

If a file begins with a named import containing inline comments, the import may be improperly formatted. This issue is currently being addressed.

```typescript
// Before
import {
  getUserByAge, // Get user by age and ID
  useDataFromStorage // Hook to get data from storage
} from '@app/dossier/help';

// After (problematic)

    getUserByAge, // Get user by age and ID
    useDataFromStorage // Hook to get data from storage
} from '@app/dossier/help';
```
