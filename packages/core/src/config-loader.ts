import * as fs from 'fs';
import * as path from 'path';

import { logDebug, logError } from './logger';

import type { Config, TidyJSConfigFile, ImportGroupFile } from './types';

// ── Constants ────────────────────────────────────────────────────────

export const CONFIG_FILE_NAMES = ['.tidyjsrc', 'tidyjs.json'];

export const DEFAULT_CONFIG: Config = {
    groups: [
        {
            name: 'Other',
            order: 0,
            default: true,
        },
    ],
    importOrder: {
        sideEffect: 0,
        default: 1,
        named: 2,
        typeOnly: 3,
    },
    format: {
        indent: 4,
        removeUnusedImports: false,
        removeMissingModules: false,
        singleQuote: true,
        bracketSpacing: true,
        organizeReExports: false,
        enforceNewlineAfterImports: true,
        blankLinesBetweenGroups: 1,
        trailingComma: 'never',
        sortSpecifiers: 'length',
        maxLineWidth: 0,
        sortEnumMembers: false,
        sortExports: false,
        sortClassProperties: false,
        sortTypeMembers: false,
        preserveComments: true,
    },
    pathResolution: {
        mode: false,
        preferredAliases: [],
    },
    excludedFolders: [],
};

// ── Types ────────────────────────────────────────────────────────────

export interface LoadConfigOptions {
    /** Path to the file being formatted (used to search for nearest config). */
    filePath: string;
    /** Root directory to stop searching at (defaults to filesystem root). */
    rootDir?: string;
    /** Override config that takes highest priority. */
    overrides?: Partial<Config>;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Walk parent directories from `filePath` toward `rootDir` looking for a
 * config file (.tidyjsrc or tidyjs.json). Uses synchronous fs operations.
 */
export function findNearestConfigFile(filePath: string, rootDir?: string): string | null {
    let currentDir = path.dirname(filePath);
    const stopAt = rootDir ?? path.parse(currentDir).root;

    logDebug(`Searching for config file starting from: ${currentDir}`);

    while (currentDir && currentDir !== path.dirname(currentDir)) {
        for (const configFileName of CONFIG_FILE_NAMES) {
            const configPath = path.join(currentDir, configFileName);
            try {
                fs.accessSync(configPath, fs.constants.R_OK);
                logDebug(`Found config file: ${configPath}`);
                return configPath;
            } catch {
                // File doesn't exist or isn't readable, continue searching
            }
        }

        if (currentDir === stopAt) {
            break;
        }

        currentDir = path.dirname(currentDir);
    }

    logDebug('No config file found');
    return null;
}

/**
 * Read and parse a JSON config file. Handles the `extends` property by
 * recursively loading and merging the base config.
 */
export function loadConfigFile(configPath: string): TidyJSConfigFile | null {
    try {
        const content = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(content) as TidyJSConfigFile;

        logDebug(`Loaded config from ${configPath}`);

        // Handle extends property
        if (config.extends) {
            const baseConfigPath = path.resolve(path.dirname(configPath), config.extends);
            const baseConfig = loadConfigFile(baseConfigPath);
            if (baseConfig) {
                return mergeFileConfigs(baseConfig, config);
            }
        }

        return config;
    } catch (error) {
        logDebug(`Failed to load config file ${configPath}: ${error}`);
        return null;
    }
}

/**
 * Convert a TidyJSConfigFile (raw JSON shape) into a partial Config object.
 * Compiles `match` strings into RegExp, resolves alias paths relative to
 * the config file location, and normalizes group ordering.
 */
export function convertFileConfig(fileConfig: TidyJSConfigFile, configPath?: string): Partial<Config> {
    const config: Partial<Config> = {
        excludedFolders: fileConfig.excludedFolders,
    };

    if (fileConfig.groups) {
        config.groups = fileConfig.groups.map((group: ImportGroupFile) => {
            // Check for deprecated isDefault property
            if ('isDefault' in group && group.isDefault !== undefined) {
                logDebug(`Detected isDefault property on group in config file: ${JSON.stringify(group)}`);
                logError(`DEPRECATION WARNING: Group "${group.name}" uses deprecated "isDefault". Use "default" instead.`);

                if (group.default === undefined) {
                    logDebug(`Auto-migrating "isDefault" to "default" for group "${group.name}"`);
                } else {
                    logError(`Group "${group.name}" has both "isDefault" and "default". Using "default" value.`);
                }
            }

            return {
                ...group,
                order: group.order ?? 999,
                default: group.default !== undefined
                    ? group.default
                    : ('isDefault' in group ? group.isDefault : false),
                match: group.match ? new RegExp(group.match) : undefined,
            };
        });
    }

    if (fileConfig.importOrder) {
        config.importOrder = {
            default: fileConfig.importOrder.default ?? 1,
            named: fileConfig.importOrder.named ?? 2,
            typeOnly: fileConfig.importOrder.typeOnly ?? 3,
            sideEffect: fileConfig.importOrder.sideEffect ?? 0,
        };
    }

    if (fileConfig.format) {
        config.format = fileConfig.format;
    }

    if (fileConfig.pathResolution) {
        config.pathResolution = { ...fileConfig.pathResolution };
        if (fileConfig.pathResolution.aliases && configPath) {
            const configDir = path.dirname(configPath);
            config.pathResolution.aliases = Object.fromEntries(
                Object.entries(fileConfig.pathResolution.aliases).map(([pattern, paths]) => [
                    pattern,
                    paths.map(p => path.resolve(configDir, p)),
                ]),
            );
        }
    }

    return config;
}

/**
 * Merge a partial config on top of the DEFAULT_CONFIG to produce a
 * complete Config object.
 */
export function resolveConfig(partial: Partial<Config>): Config {
    const result = structuredClone(DEFAULT_CONFIG);

    if (partial.groups !== undefined) {
        result.groups = partial.groups;
    }

    if (partial.importOrder) {
        result.importOrder = { ...result.importOrder, ...partial.importOrder };
    }

    if (partial.format) {
        result.format = { ...result.format, ...partial.format };
    }

    if (partial.pathResolution) {
        result.pathResolution = { ...result.pathResolution, ...partial.pathResolution };
    }

    if (partial.excludedFolders !== undefined) {
        result.excludedFolders = partial.excludedFolders;
    }

    if (partial.debug !== undefined) {
        result.debug = partial.debug;
    }

    return result;
}

/**
 * Full orchestrator: find the nearest config file, load it, convert it,
 * apply overrides, and merge with defaults.
 */
export function loadConfig(options: LoadConfigOptions): Config {
    const { filePath, rootDir, overrides } = options;

    // 1. Find nearest config file
    const configPath = findNearestConfigFile(filePath, rootDir);

    let partial: Partial<Config> = {};

    if (configPath) {
        const fileConfig = loadConfigFile(configPath);
        if (fileConfig) {
            partial = convertFileConfig(fileConfig, configPath);
        }
    }

    // 2. Apply caller overrides (highest priority)
    if (overrides) {
        partial = mergePartials(partial, overrides);
    }

    // 3. Merge with defaults
    return resolveConfig(partial);
}

// ── Internal helpers ─────────────────────────────────────────────────

function mergeFileConfigs(base: TidyJSConfigFile, override: TidyJSConfigFile): TidyJSConfigFile {
    return {
        ...base,
        ...override,
        importOrder: {
            ...base.importOrder,
            ...override.importOrder,
        },
        format: {
            ...base.format,
            ...override.format,
        },
        pathResolution: {
            ...base.pathResolution,
            ...override.pathResolution,
        },
        groups: override.groups || base.groups,
        excludedFolders: override.excludedFolders || base.excludedFolders,
    };
}

function mergePartials(base: Partial<Config>, override: Partial<Config>): Partial<Config> {
    const result = { ...base };

    if (override.groups !== undefined) {
        result.groups = override.groups;
    }

    if (override.importOrder) {
        result.importOrder = { ...result.importOrder, ...override.importOrder } as Config['importOrder'];
    }

    if (override.format) {
        result.format = { ...result.format, ...override.format };
    }

    if (override.pathResolution) {
        result.pathResolution = { ...result.pathResolution, ...override.pathResolution };
    }

    if (override.excludedFolders !== undefined) {
        result.excludedFolders = override.excludedFolders;
    }

    if (override.debug !== undefined) {
        result.debug = override.debug;
    }

    return result;
}
