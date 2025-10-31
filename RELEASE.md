# TidyJS Release Guide

## Development Workflow

### Daily Development

```bash
npm run dev          # Watch mode
npm run check        # Type check + lint + tests
npm run test:watch   # Watch mode tests
npm run lint:fix     # Auto-fix linting errors
```

### Pre-commit

```bash
npm run check
```

### Release

#### Patch (bug fix) - 1.3.5 → 1.3.6
```bash
npm run release:patch
```

#### Minor (new features) - 1.3.5 → 1.4.0
```bash
npm run release:minor
```

#### Major (breaking changes) - 1.3.5 → 2.0.0
```bash
npm run release:major
```

Automatic steps:
1. TypeScript type check
2. ESLint
3. All tests
4. Version bump in package.json and CHANGELOG.md
5. Build .vsix file

### Publish to VS Code Marketplace

```bash
vsce publish
```

Or via web: https://marketplace.visualstudio.com/manage

## Available Scripts

### Development
- `npm run dev` - Watch mode
- `npm run compile` - Single compilation

### Quality
- `npm run check` - Full validation (types + lint + tests)
- `npm run test` - Unit tests
- `npm run test:watch` - Watch mode tests
- `npm run test:coverage` - Tests with coverage
- `npm run lint` - ESLint check
- `npm run lint:fix` - Auto-fix ESLint errors

### Release
- `npm run release:patch` - Patch release
- `npm run release:minor` - Minor release
- `npm run release:major` - Major release
- `npm run build` - Manual .vsix build
