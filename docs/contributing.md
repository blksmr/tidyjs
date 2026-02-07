# Contributing

We welcome contributions to TidyJS.

## Development Setup

```bash
git clone https://github.com/asmirbe/tidyjs.git
cd tidyjs
npm install
npm run dev
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Development mode with file watching |
| `npm run test` | Run Jest unit tests |
| `npm run test:e2e` | Run end-to-end VS Code tests |
| `npm run lint` | Lint codebase with ESLint |
| `npm run check` | Full validation (type check + lint + test) |
| `npm run build` | Build production extension |

## Project Architecture

### Core Components

1. **Parser (`src/parser.ts`)**: AST-based import analysis
   - Uses oxc-parser (Rust-based, ESTree-compatible) via `src/utils/oxc-parse.ts`
   - Smart mixed import separation
   - Categorizes imports by type

2. **Formatter (`src/formatter.ts`)**: Visual formatting engine
   - IR-based pipeline (`ParsedImport[] → IR → Printer → String`)
   - Aligns 'from' keywords
   - Handles multiline imports

3. **Extension (`src/extension.ts`)**: VS Code integration
   - Command registration
   - Format-on-save functionality
   - Configuration management

4. **Configuration (`src/utils/config.ts`)**: ConfigManager
   - Advanced caching with RegExp serialization
   - Validation with error reporting
   - Dynamic subfolder detection

### Import Processing Flow

1. AST Analysis: Extract imports using oxc-parser AST
2. Smart Separation: Separate mixed imports by type
3. Type Categorization: Classify each import
4. Group Matching: Match imports to groups using regex
5. Consolidation: Merge same-type imports from same source
6. Sorting: Sort by configured order and priority
7. Alignment: Apply visual alignment and spacing
8. Output: Write formatted imports to document

## Contributing Guidelines

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make changes with comprehensive tests
4. Run validation: `npm run check`
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## Code Style

- TypeScript with strict typing
- Single quotes for strings
- 4-space indentation
- Semicolons required
- No `any` types
- camelCase for variables and functions

## Testing

- Jest with ts-jest for unit tests
- Tests in `test/parser/` directory
- Mock VS Code API in `test/mocks/vscode.js`
- Test fixtures in `test/fixtures/`
