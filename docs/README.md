# TidyJS Documentation

Complete documentation for the TidyJS VS Code extension for organizing and formatting TypeScript/JavaScript imports.

## Table of Contents

### Configuration and Options

- [**Configuration**](configuration.md) — Complete configuration guide: hierarchy, groups, formatting options, path resolution, excluded folders, and full options reference.
- [**Formatting Options**](formatting-options.md) — Detailed advanced formatting options: specifier sorting, trailing comma, line width, group spacing, and newline handling.
- [**Path Aliases**](path-aliases.md) — Path resolution configuration and custom aliases for converting relative imports to absolute aliases.
- [**Automatic Order Resolution**](auto-order.md) — Automatic conflict resolution system for group ordering and sequential assignment of missing orders.

### Features

- [**Supported Import Types**](import-types.md) — All import types handled by TidyJS: default, named, namespace, type, side-effect, and automatic mixed import separation.
- [**Property Sorting**](sort-properties.md) — Manual property sorting command for objects, interfaces, types, and destructuring via selection.
- [**Re-export Organization**](reexport-organizer.md) — Automatic grouping, sorting, and alignment of re-exports (`export { ... } from '...'`).
- [**Ignore Pragma**](ignore-pragma.md) — Syntax for excluding an entire file from TidyJS formatting.
- [**Batch Formatting**](batch-formatting.md) — Automatic formatting of all files in a folder or workspace with a detailed report.

### Internal Pipeline

- [**IR Pipeline**](ir-pipeline.md) — Formatting engine architecture: IR (Intermediate Representation) pipeline, builders, printer, and alignment.

### Help

- [**Troubleshooting**](troubleshooting.md) — Solutions to common issues, configuration validation, debug mode, and error recovery.
- [**Contributing**](contributing.md) — Contribution guide: development setup, project architecture, available scripts, and code conventions.
