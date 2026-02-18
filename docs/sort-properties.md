# Property Sorting

TidyJS offers two modes for sorting properties in your TypeScript/JavaScript code:

- **Manual mode**: "TidyJS: Sort Properties" command (requires a selection)
- **Automatic mode**: sorting during formatting, enabled via configuration

Sorting is done by **name length** (shortest to longest), with alphabetical sorting as a tiebreaker.

---

## Manual Mode — "TidyJS: Sort Properties" Command

**Command**: `TidyJS: Sort Properties` (command palette: `Ctrl+Shift+P`)

**Prerequisite**: select the code to sort before running the command. Without a selection, a message prompts you to make one.

### Supported Types

#### Destructuring (ObjectPattern)

Destructured variables, function parameters, and arrow function parameters.

**Before:**
```typescript
const {
    className,
    datatestIdAttribute,
    datatestId,
    classesFunctions
} = props;
```

**After:**
```typescript
const {
    className,
    datatestId,
    classesFunctions,
    datatestIdAttribute
} = props;
```

Rest elements (`...rest`) are always placed last:

```typescript
// Before
const {
    longName,
    a,
    ...rest
} = props;

// After
const {
    a,
    longName,
    ...rest
} = props;
```

Properties with default values or aliases are sorted by the **key name**:

```typescript
// Before
const {
    longPropertyName: short,
    b: something,
    med: other,
} = config;

// After
const {
    b: something,
    med: other,
    longPropertyName: short,
} = config;
```

#### Object Literals (ObjectExpression)

Object literals are only sorted via the manual command, never automatically.

**Before:**
```typescript
const obj = {
    telephone: '123',
    id: 1,
    name: 'test',
};
```

**After:**
```typescript
const obj = {
    id: 1,
    name: 'test',
    telephone: '123',
};
```

Also works inside constructor calls:

```typescript
// Before
const model = new UserModel({
    additional_info: '',
    type: 'foo',
    name: '',
    email: '',
});

// After
const model = new UserModel({
    name: '',
    type: 'foo',
    email: '',
    additional_info: '',
});
```

#### Interfaces (TSInterfaceBody)

**Before:**
```typescript
interface Props {
    className: string;
    datatestIdAttribute: string;
    datatestId: string;
}
```

**After:**
```typescript
interface Props {
    className: string;
    datatestId: string;
    datatestIdAttribute: string;
}
```

#### Type Literals (TSTypeLiteral)

**Before:**
```typescript
type Props = {
    className: string;
    datatestIdAttribute: string;
    datatestId: string;
};
```

**After:**
```typescript
type Props = {
    className: string;
    datatestId: string;
    datatestIdAttribute: string;
};
```

#### JSX Attributes

JSX attributes (props) on components. Boolean shorthand props are placed first, then valued props. Spread attributes (`{...props}`) are always placed last.

**Before:**
```tsx
<DataTable
    isLoading={ data?.isLoading }
    showCount
    totalItems={ data?.total_items }
    table={ table }
    hasPagination
/>
```

**After:**
```tsx
<DataTable
    table={ table }
    showCount
    hasPagination
    isLoading={ data?.isLoading }
    totalItems={ data?.total_items }
/>
```

Nested objects within JSX props are also sorted recursively:

```tsx
<YpInput
    icon={ {
        name: 'search',
        style: 'far',
        position: 'left',
    } }
    autoFocus
    type='search'
    placeholder='Rechercher...'
/>
```

### Manual Mode Behavior

- **Multiline only**: single-line structures are not modified.
- **Trailing comma**: the existing style (with or without trailing comma) is preserved.
- **Nested objects**: if the selection covers multiple sortable structures, each is sorted independently. Overlapping AST ranges are handled automatically via iterative passes (max 10).
- **Computed properties** (`[COMPUTED_KEY]`): the structure is skipped to avoid corruption.
- **Index signatures** (`[key: string]: unknown`): the structure is skipped.
- **Comments**: comments are moved with their associated property during sorting (see `preserveComments` option below). Blank lines between properties are removed.
- **Idempotence**: applying the command twice produces the same result.

---

## Automatic Mode — Sorting During Formatting

These options are enabled in the configuration and apply automatically each time the document is formatted (on save, format command).

Automatic mode **never** sorts destructurings, object literals, interfaces, or type literals. Use the manual command for those.

### sortEnumMembers

Sorts multiline enum members by name length.

**Configuration:**
```json
{
  "format": {
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

Works with or without initializers:

```typescript
// Before
enum Direction {
    Southeast,
    Up,
    Down,
}

// After
enum Direction {
    Up,
    Down,
    Southeast,
}
```

### sortExports

Sorts multiline export specifiers by exported name length.

**Configuration:**
```json
{
  "format": {
    "sortExports": true
  }
}
```

**Before:**
```typescript
export {
    useCallback,
    useState,
    FC,
} from 'react';
```

**After:**
```typescript
export {
    FC,
    useState,
    useCallback,
} from 'react';
```

Aliases are sorted by the exported name (`as ...`):

```typescript
// Before
export {
    internalLongName as longExportedName,
    foo as ab,
} from './mod';

// After
export {
    foo as ab,
    internalLongName as longExportedName,
} from './mod';
```

### sortClassProperties

Sorts instance properties of a class by name length. `static` properties and methods are not affected.

**Configuration:**
```json
{
  "format": {
    "sortClassProperties": true
  }
}
```

**Before:**
```typescript
class User {
    telephone: string;
    id: string;
    name: string;
    email: string;
}
```

**After:**
```typescript
class User {
    id: string;
    name: string;
    email: string;
    telephone: string;
}
```

Static properties are not moved and act as separators:

```typescript
// Before
class Foo {
    static instance: Foo;
    longName: string;
    a: number;
}

// After
class Foo {
    static instance: Foo;
    a: number;
    longName: string;
}
```

### sortTypeMembers

Sorts interface and type literal properties by name length during automatic formatting.

**Configuration:**
```json
{
  "format": {
    "sortTypeMembers": true
  }
}
```

**Before:**
```typescript
interface Props {
    className: string;
    datatestIdAttribute: string;
    datatestId: string;
}
```

**After:**
```typescript
interface Props {
    className: string;
    datatestId: string;
    datatestIdAttribute: string;
}
```

Blocks containing comments are **skipped** in automatic mode.

### Automatic Mode Behavior

- **Multiline only**: single-line structures are not modified.
- **Comments**: if a block contains comments (`//` or `/* */`), it is **skipped** to avoid breaking the developer's intent.
- **Computed properties**: structures with computed keys are skipped.
- **Idempotence**: sorting applied twice produces the same result.

---

## Comment Handling — `preserveComments`

The `preserveComments` option controls how comments are handled during manual sorting (the "Sort Properties" command).

| Value | Behavior |
|-------|----------|
| `true` (default) | Comments are moved with their associated property. Blank lines between properties are removed. |
| `false` | Comments are stripped during sorting. |

**Configuration:**

```json
{
  "format": {
    "preserveComments": true
  }
}
```

**Example with `preserveComments: true` (default):**

```typescript
// Before
type TProps = {
    needExportConfirmation: boolean;
    // Select props
    selectProps?: string;
    // Analyses select props
    showAnalyse?: boolean;
};

// After — comments travel with their property
type TProps = {
    // Select props
    selectProps?: string;
    // Analyses select props
    showAnalyse?: boolean;
    needExportConfirmation: boolean;
};
```

**Example with `preserveComments: false`:**

```typescript
// After — comments stripped, properties sorted
type TProps = {
    selectProps?: string;
    showAnalyse?: boolean;
    needExportConfirmation: boolean;
};
```

---

## Configuration

### In `.tidyjsrc` / `tidyjs.json`

```json
{
  "format": {
    "sortEnumMembers": true,
    "sortExports": true,
    "sortClassProperties": true,
    "sortTypeMembers": true,
    "preserveComments": true
  }
}
```

### In VS Code Settings (`settings.json`)

```json
{
  "tidyjs.format.sortEnumMembers": true,
  "tidyjs.format.sortExports": true,
  "tidyjs.format.sortClassProperties": true,
  "tidyjs.format.sortTypeMembers": true,
  "tidyjs.format.preserveComments": true
}
```

The manual "TidyJS: Sort Properties" command requires no configuration. It is always available via the command palette.

---

## Summary

| Structure Type | Manual Mode | Automatic Mode | Config Option |
|---|---|---|---|
| Destructuring (ObjectPattern) | Yes | No | none |
| Object Literal (ObjectExpression) | Yes | No | none |
| Interface (TSInterfaceBody) | Yes | Yes | `sortTypeMembers` |
| Type Literal (TSTypeLiteral) | Yes | Yes | `sortTypeMembers` |
| JSX Attributes (JSXOpeningElement) | Yes | No | none |
| Enum (TSEnumDeclaration) | No | Yes | `sortEnumMembers` |
| Export (ExportNamedDeclaration) | No | Yes | `sortExports` |
| Class Properties (ClassBody) | No | Yes | `sortClassProperties` |
