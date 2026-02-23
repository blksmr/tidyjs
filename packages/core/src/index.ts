// ── Logger ───────────────────────────────────────────────────────────
export { setLogger, logDebug, logError } from './logger';
export type { Logger } from './logger';

// ── Types ────────────────────────────────────────────────────────────
export type { Config, TidyJSConfigFile, ImportGroupFile, ConfigSource } from './types';

// ── Parser ───────────────────────────────────────────────────────────
export { ImportParser, ImportType, parseImports } from './parser';
export type { ParsedImport, ParserResult, InvalidImport, ImportSource, ImportSpecifier } from './parser';

// ── Formatter ────────────────────────────────────────────────────────
export { formatImports } from './formatter';

// ── Destructuring Sorter ─────────────────────────────────────────────
export { sortCodePatterns, sortPropertiesInSelection } from './destructuring-sorter';

// ── Re-export Organizer ──────────────────────────────────────────────
export { organizeReExports } from './reexport-organizer';

// ── Config Loader ────────────────────────────────────────────────────
export {
    loadConfig,
    resolveConfig,
    findNearestConfigFile,
    loadConfigFile,
    convertFileConfig,
    DEFAULT_CONFIG,
    CONFIG_FILE_NAMES,
} from './config-loader';
export type { LoadConfigOptions } from './config-loader';

// ── IR ───────────────────────────────────────────────────────────────
export { buildDocument } from './ir/builders';
export { printDocument } from './ir/printer';

// ── Utils ────────────────────────────────────────────────────────────
export { hasIgnorePragma } from './utils/ignore-pragma';
export { GroupMatcher } from './utils/group-matcher';
export { parseSource } from './utils/oxc-parse';
export { cloneDeepWith } from './utils/deep-clone';
export { ConfigCache } from './utils/config-cache';
