# Supported Import Types

TidyJS handles all TypeScript and JavaScript import syntax with intelligent separation and organization.

## Basic Import Types

| Type | Example | Internal Classification |
|------|---------|------------------------|
| Side-effect | `import './styles.css';` | `sideEffect` |
| Default | `import React from 'react';` | `default` |
| Named | `import { useState } from 'react';` | `named` |
| Namespace | `import * as Utils from './utils';` | `default` |

## TypeScript Type Imports

| Type | Example | Internal Classification |
|------|---------|------------------------|
| Type Default | `import type React from 'react';` | `typeDefault` |
| Type Named | `import type { FC } from 'react';` | `typeNamed` |
| Type Namespace | `import type * as Types from './types';` | `typeDefault` |

## Mixed Import Separation

TidyJS automatically separates all mixed import combinations into clean, organized individual imports.

### Default + Named

```typescript
// Input
import React, { useState } from 'react';

// Output
import React from 'react';
import { useState } from 'react';
```

### Named + Type Named

```typescript
// Input
import { useState, type FC } from 'react';

// Output
import { useState } from 'react';
import type { FC } from 'react';
```

### Default + Named + Type Named (3-way split)

```typescript
// Input
import React, { useState, type FC } from 'react';

// Output
import React from 'react';
import { useState } from 'react';
import type { FC } from 'react';
```

### Default + Namespace

```typescript
// Input
import React, * as ReactDOM from 'react-dom';

// Output
import React from 'react-dom';
import * as ReactDOM from 'react-dom';
```

### Type Default + Type Named

```typescript
// Input
import type React, { FC } from 'react';

// Output
import type React from 'react';
import type { FC } from 'react';
```

## Complex Syntax Support

### Aliased Imports

```typescript
import { useState as state, useEffect as effect } from 'react';
```

### Mixed Aliases and Types

```typescript
import React, { Component as Comp, type FC } from 'react';
```

### Large Multiline Imports

TidyJS handles imports with 100+ specifiers:

```typescript
import {
  Button,
  TextField,
  Grid,
  Paper,
  Dialog,
  type Theme,
  type Palette
} from '@mui/material';
```

### Special Characters

```typescript
import worker from './worker?worker';
import styles from './component.module.css';
```

## Before and After Example

**Before TidyJS:**
```typescript
import { YpTable, YpDivider, YpTypography, YpElement, YpTag, YpButton } from 'ds';
import React, { FC, useState, type ReactNode, type ComponentProps } from 'react';
import cn from 'classnames';
import type { User } from '@app/dossier/models';
import { formatDate } from '@library/helpers';
import { useTranslation } from '@core/i18n';
import * as Utils from './utils';
```

**After TidyJS:**
```typescript
// React
import React from 'react';
import { FC, useState } from 'react';
import type { ReactNode, ComponentProps } from 'react';

// External Libraries
import cn from 'classnames';

// DS Components
import { YpButton, YpDivider, YpElement, YpTag, YpTable, YpTypography } from 'ds';

// @app/dossier
import type { User } from '@app/dossier/models';

// @core
import { useTranslation } from '@core/i18n';

// @library
import { formatDate } from '@library/helpers';

// Local
import * as Utils from './utils';
```
