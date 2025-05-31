# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# TidyJS - Import Organization VS Code Extension

TidyJS is a VS Code extension that automatically organizes and formats import declarations in TypeScript/JavaScript files. It groups imports by customizable categories, aligns 'from' keywords, and sorts imports by type and length.

## Build/Test/Lint Commands
- Build: `npm run compile` 
- Watch mode: `npm run watch`
- Production build: `npm run build-prod`
- Run all tests: `npm run test:unit`
- Run specific test: `jest test/parser/file-name.test.ts -t "test description"`
- Type check: `npm run check-types`
- Lint: `npm run lint`
- Fix lint issues: `npm run lint:fix`
- Package extension: `npm run build` (creates .vsix file)
- Version bump: `npm run bump:patch` / `bump:minor` / `bump:major`

## Architecture

### Core Components
1. **Parser (`src/parser.ts`)**: Uses @typescript-eslint/parser to analyze imports
   - Processes TypeScript/JavaScript AST to extract import information
   - Categorizes imports by type (default, named, typeDefault, typeNamed, sideEffect)
   - Groups imports based on regex patterns from configuration

2. **Formatter (`src/formatter.ts`)**: Handles visual formatting and alignment
   - Uses @babel/parser for robust parsing with error recovery
   - Aligns 'from' keywords across import groups
   - Handles multiline imports and preserves comments
   - Manages spacing and indentation

3. **Extension (`src/extension.ts`)**: VS Code integration
   - Registers commands and keybindings
   - Handles format-on-save functionality
   - Manages configuration updates and validation
   - Provides error recovery and user notifications

4. **Configuration (`src/utils/config.ts`)**: ConfigManager singleton
   - Validates configuration on updates
   - Manages group patterns and import ordering
   - Handles dynamic subfolder detection for @app modules
   - Provides real-time configuration change events

### Import Processing Flow
1. Parser extracts imports from source code
2. Imports are categorized by type and matched to groups
3. Groups are sorted by configured order
4. Within groups, imports are sorted by type order then alphabetically
5. Formatter applies visual alignment and spacing
6. Extension writes formatted imports back to document

## Code Style
- TypeScript with strict typing - explicit return types required
- Single quotes for strings
- 4-space indentation
- Semicolons required
- No `any` types - code must be strongly typed
- Import sorting hierarchy: sideEffect → default → named → typeDefault → typeNamed
- React imports always first within their group
- camelCase for variables and functions
- Comprehensive error handling with utils/log.ts

## Testing
- Jest with ts-jest for unit tests
- Tests located in `test/parser/` directory
- Mock VS Code API provided in `test/mocks/vscode.js`
- Test fixtures in `test/fixtures/` with input/expected pairs
- Performance benchmarks included for large files