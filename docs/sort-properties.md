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

### Manual Mode Behavior

- **Multiline only**: single-line structures are not modified.
- **Trailing comma**: the existing style (with or without trailing comma) is preserved.
- **Nested objects**: if the selection covers multiple sortable structures, each is sorted independently. Overlapping AST ranges are handled automatically via iterative passes (max 10).
- **Computed properties** (`[COMPUTED_KEY]`): the structure is skipped to avoid corruption.
- **Index signatures** (`[key: string]: unknown`): the structure is skipped.
- **Comments**: in manual mode, the presence of comments does not prevent sorting (the user has explicitly chosen to sort).
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

### Automatic Mode Behavior

- **Multiline only**: single-line structures are not modified.
- **Comments**: if a block contains comments (`//` or `/* */`), it is **skipped** to avoid breaking the developer's intent.
- **Computed properties**: structures with computed keys are skipped.
- **Idempotence**: sorting applied twice produces the same result.

---

## Configuration

### In `.tidyjsrc` / `tidyjs.json`

```json
{
  "format": {
    "sortEnumMembers": true,
    "sortExports": true,
    "sortClassProperties": true
  }
}
```

### In VS Code Settings (`settings.json`)

```json
{
  "tidyjs.format.sortEnumMembers": true,
  "tidyjs.format.sortExports": true,
  "tidyjs.format.sortClassProperties": true
}
```

The manual "TidyJS: Sort Properties" command requires no configuration. It is always available via the command palette.

---

## Summary

| Structure Type | Manual Mode | Automatic Mode | Config Option |
|---|---|---|---|
| Destructuring (ObjectPattern) | Yes | No | none |
| Object Literal (ObjectExpression) | Yes | No | none |
| Interface (TSInterfaceBody) | Yes | No | none |
| Type Literal (TSTypeLiteral) | Yes | No | none |
| Enum (TSEnumDeclaration) | No | Yes | `sortEnumMembers` |
| Export (ExportNamedDeclaration) | No | Yes | `sortExports` |
| Class Properties (ClassBody) | No | Yes | `sortClassProperties` |
