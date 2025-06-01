# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Import Type Enum**: Introduced `ImportType` enum replacing string literals for better type safety and maintainability (#afed51b)
- **Unused Imports Detection**: New `removeUnusedImports` configuration option to automatically remove unused imports (#680c3c1)
- **Missing Modules Detection**: New `removeMissingModules` configuration option to remove imports from non-existent modules (#680c3c1)
- **Excluded Folders**: Added `excludedFolders` configuration to skip formatting in specific directories (#51fdd17)
- **Configuration Validation Command**: New `tidyjs.testValidation` command for debugging configuration issues
- **Context Menu Integration**: Added "Format Imports" to the editor context menu for TypeScript/JavaScript files
- **CLAUDE.md**: Added AI assistant guidance file for better development experience
- **Comprehensive Test Suite**: New test structure in `test/parser/` with specialized test categories

### Changed
- **Parser Migration**: Replaced external `tidyjs-parser` with internal parser using `@typescript-eslint/parser` for better AST analysis (#08fb65d)
- **Configuration System**: Complete rewrite of `ConfigManager` with automatic validation and repair mechanisms (#1cf1f21)
- **Import Formatting**: Added blank lines between import groups for better readability (#6f94516)
- **Build System**: Migrated from `esbuild.js` to `scripts/build.js` with improved build process
- **ESLint Configuration**: Migrated from `eslint.config.js` to `eslint.config.mjs` (#b715a60)
- **Import Consolidation**: Imports from the same source are now properly merged (#54de8d2)
- **Empty Imports Handling**: Empty imports are now treated as side-effect imports (#0e184f0)
- **Error Recovery**: Enhanced error handling with automatic extension disabling on configuration errors (#baf3663)
- **Test Structure**: Complete reorganization from `test/unit/` to `test/parser/` with more focused tests

### Deprecated
- Legacy import type strings in favor of the new `ImportType` enum

### Removed
- External `tidyjs-parser` dependency - replaced with internal implementation
- `test-runner.sh` script - using standard Jest commands instead
- Old test structure in `test/unit/` directory
- Legacy test fixtures in `test/fixtures/input/` and `test/fixtures/expected/`

### Fixed
- **Configuration Errors**: Extension now properly disables itself when configuration is invalid (#baf3663)
- **Type Import Detection**: Improved detection using AST instead of string parsing (#59cc990)
- **Mixed Import Sorting**: Better handling of imports combining default and named exports (#6d8172f)
- **Import Parsing**: More robust error detection and recovery (#5b6ba1c)
- **Multiline Import Alignment**: Fixed alignment issues with multiline imports

### Security
- Added stricter TypeScript configuration with `strict: true` for better type safety (#bd38494)
- Improved validation of user-provided regex patterns in configuration