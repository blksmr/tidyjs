# Auto-Order Resolution System

TidyJS includes an intelligent auto-order resolution system that automatically handles group ordering configuration.

## How It Works

The system processes group configurations in two phases:

1. **Collision Resolution**: Groups with explicit orders that conflict are automatically pushed to the next available order slot
2. **Auto-Assignment**: Groups without explicit orders are automatically assigned sequential order numbers starting from 0

## Configuration Example

### Input (with conflicts)

```json
{
  "groups": [
    { "name": "React", "order": 1 },
    { "name": "Utils", "order": 1 },
    { "name": "External" },
    { "name": "Internal", "order": 0 }
  ]
}
```

### Auto-resolved Result

```
Internal: 0 (kept original)
External: 2 (auto-assigned)
React: 1 (kept original, no collision)
Utils: 3 (collision resolved)
```

## Features

### Collision Resolution

- Groups with duplicate orders are pushed to the next available slot
- Original order preference is preserved when possible
- Collision adjustments are logged for transparency

### Missing Order Assignment

- Groups without explicit `order` values get auto-assigned
- Assignment starts from 0 and avoids conflicts
- Maintains predictable and consistent ordering

### Validation

```typescript
// Valid order values (automatically handled)
{ "order": 0 }     // Valid (default groups)
{ "order": 5 }     // Valid
{ "order": 1001 }  // Valid but warns about high values

// Invalid order values (treated as missing)
{ "order": -1 }    // Negative: auto-assigned
{ "order": 1.5 }   // Decimal: auto-assigned
{ "order": "3" }   // String: auto-assigned
```

### Debug Logging

```
[DEBUG] Group "Utils" order adjusted from 3 to 4 due to collision
[DEBUG] High order value detected: 1001 for group "External". Consider using lower values.
```

## Real-World Scenarios

### Team Configuration Conflicts

```json
// Developer A adds:
{ "name": "API", "match": "^@/api", "order": 2 }

// Developer B adds (same order):
{ "name": "Hooks", "match": "^@/hooks", "order": 2 }

// Result: Auto-resolved to API: 2, Hooks: 3
```

### Legacy Migration

```json
// Old config with missing orders:
[
  { "name": "React", "match": "^react" },
  { "name": "External", "match": "^[^@]" },
  { "name": "Internal", "match": "^@/" },
  { "name": "Other", "order": 99, "default": true }
]

// Auto-assigned:
// React: 0, External: 1, Internal: 2, Other: 99
```

## Benefits

- **Zero Breaking Changes**: Existing configurations continue to work
- **Reduced Configuration Errors**: No duplicate order validation failures
- **Simplified Setup**: Add groups without calculating order numbers
- **Team Collaboration**: Multiple developers can add groups without conflicts
- **Future-Proof**: Configuration grows organically without manual maintenance
