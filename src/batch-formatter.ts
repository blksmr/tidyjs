import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { formatImports } from './formatter';
import { sortCodePatterns } from './destructuring-sorter';
import { organizeReExports } from './reexport-organizer';
import { ImportParser } from './parser';
import { PathResolver } from './utils/path-resolver';
import { configManager } from './utils/config';
import { ConfigLoader } from './utils/configLoader';
import { hasIgnorePragma } from './utils/ignore-pragma';
import { logDebug, logError } from './utils/log';

import type { Config } from './types';
import type { ParserResult, ParsedImport, ImportSource } from './parser';

// --- Types ---

export interface BatchFormatResult {
    formatted: number;
    skipped: number;
    errors: { filePath: string; error: string }[];
    totalFiles: number;
}

export interface BatchFormatCallbacks {
    onProgress: (current: number, total: number, filePath: string) => void;
    isCancelled: () => boolean;
    createUri: (filePath: string) => vscode.Uri;
}

// --- Constants ---

const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

const ALWAYS_SKIP_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', 'out',
    '.next', 'coverage', '.cache', '.turbo',
]);

// --- Internal functions ---

export async function discoverFiles(folderPath: string): Promise<string[]> {
    const files: string[] = [];
    const visited = new Set<string>();

    async function walk(dir: string): Promise<void> {
        let realDir: string;
        try {
            realDir = await fs.promises.realpath(dir);
        } catch {
            return;
        }

        if (visited.has(realDir)) {
            return;
        }
        visited.add(realDir);

        let entries: fs.Dirent[];
        try {
            entries = await fs.promises.readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                if (!ALWAYS_SKIP_DIRS.has(entry.name)) {
                    await walk(fullPath);
                }
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (SUPPORTED_EXTENSIONS.has(ext)) {
                    files.push(fullPath);
                }
            }
        }
    }

    await walk(folderPath);
    return files;
}

export function isFileInExcludedFolder(
    filePath: string,
    config: Config,
    workspaceRoot: string | undefined
): boolean {
    const excludedFolders = config.excludedFolders;
    if (!excludedFolders || excludedFolders.length === 0 || !workspaceRoot) {
        return false;
    }

    const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');

    return excludedFolders.some((excluded) => {
        const normalizedExcluded = excluded.replace(/\\/g, '/');
        return relativePath.startsWith(normalizedExcluded + '/') || relativePath === normalizedExcluded;
    });
}

export type SkipReason = 'empty' | 'ignored' | 'no-imports' | 'unchanged';

export interface SingleFileResult {
    changed: boolean;
    error?: string;
    skipReason?: SkipReason;
}

export async function formatSingleFile(
    filePath: string,
    config: Config,
    parserCache: Map<string, ImportParser>,
    workspaceRoot?: string
): Promise<SingleFileResult> {
    let sourceText: string;
    try {
        sourceText = await fs.promises.readFile(filePath, 'utf8');
    } catch (error) {
        return { changed: false, error: `Failed to read file: ${error}` };
    }

    // Skip empty files
    if (!sourceText.trim()) {
        return { changed: false, skipReason: 'empty' };
    }

    // Skip files with tidyjs-ignore pragma
    if (hasIgnorePragma(sourceText)) {
        return { changed: false, skipReason: 'ignored' };
    }

    // Get or create parser for this config
    const configKey = JSON.stringify(config);
    let parser = parserCache.get(configKey);
    if (!parser) {
        parser = new ImportParser(config);
        parserCache.set(configKey, parser);
    }

    // Parse the source
    let parserResult: ParserResult;
    try {
        parserResult = parser.parse(sourceText, undefined, undefined, filePath);
    } catch (error) {
        return { changed: false, error: `Parse error: ${error}` };
    }

    // Apply path resolution if enabled
    if (config.pathResolution?.enabled && workspaceRoot) {
        try {
            const pathResolver = new PathResolver({
                mode: config.pathResolution.mode || 'relative',
                preferredAliases: config.pathResolution.preferredAliases || [],
                aliases: config.pathResolution.aliases,
            });
            const enhanced = applyPathResolutionBatch(
                parserResult, pathResolver, filePath, parser,
                config.pathResolution.mode || 'relative', workspaceRoot
            );
            if (enhanced) { parserResult = enhanced; }
        } catch (error) {
            logError('Error during batch path resolution:', error);
        }
    }

    // Skip files with invalid imports
    if (parserResult.invalidImports && parserResult.invalidImports.length > 0) {
        return { changed: false, error: `Invalid imports: ${parserResult.invalidImports[0].error}` };
    }

    let finalText = sourceText;
    const hasImports = parserResult.importRange && parserResult.groups.length > 0;

    // Format imports if there are any
    if (hasImports) {
        const formattedDocument = await formatImports(sourceText, config, parserResult);
        if (formattedDocument.error) {
            return { changed: false, error: `Format error: ${formattedDocument.error}` };
        }
        finalText = formattedDocument.text;
    }

    // Post-processing: sort enums/exports/class properties
    if (config.format?.sortEnumMembers ||
        config.format?.sortExports ||
        config.format?.sortClassProperties) {
        finalText = sortCodePatterns(finalText, config);
    }

    // Post-processing: organize re-exports
    if (config.format?.organizeReExports) {
        finalText = organizeReExports(finalText, config);
    }

    // No changes needed
    if (finalText === sourceText) {
        return { changed: false, skipReason: hasImports ? 'unchanged' : 'no-imports' };
    }

    // Validation: re-parse the formatted output to ensure it's valid
    try {
        const validationResult = parser.parse(finalText, undefined, undefined, filePath);
        if (validationResult.invalidImports && validationResult.invalidImports.length > 0) {
            return { changed: false, error: 'Post-format validation failed: output has invalid imports' };
        }
    } catch {
        return { changed: false, error: 'Post-format validation failed: output cannot be parsed' };
    }

    // Write the formatted file
    try {
        await fs.promises.writeFile(filePath, finalText, 'utf8');
    } catch (error) {
        return { changed: false, error: `Failed to write file: ${error}` };
    }

    return { changed: true };
}

// --- Path resolution for batch mode ---

function applyPathResolutionBatch(
    originalResult: ParserResult,
    pathResolver: PathResolver,
    filePath: string,
    parserInstance: ImportParser,
    mode: 'absolute' | 'relative',
    workspaceRoot: string
): ParserResult | null {
    try {
        const allImports: ParsedImport[] = [];
        for (const group of originalResult.groups) {
            allImports.push(...group.imports);
        }

        const convertedImports: ParsedImport[] = [];
        let hasChanges = false;
        let convertedCount = 0;

        for (const importInfo of allImports) {
            const resolvedPath = pathResolver.convertImportPathBatch(
                importInfo.source,
                filePath,
                workspaceRoot
            );

            if (resolvedPath && resolvedPath !== importInfo.source) {
                let groupName = importInfo.groupName;
                let isPriority = importInfo.isPriority;

                // Only re-group in absolute mode — the new alias path may match a different group.
                if (mode === 'absolute') {
                    const result = parserInstance.determineGroup(resolvedPath);
                    groupName = result.groupName;
                    isPriority = result.isPriority;
                }

                convertedImports.push({
                    ...importInfo,
                    source: resolvedPath as ImportSource,
                    groupName,
                    isPriority
                });
                hasChanges = true;
                convertedCount++;
                logDebug(`Path resolved (batch): ${importInfo.source} -> ${resolvedPath} (group: ${groupName})`);
            } else {
                convertedImports.push(importInfo);
            }
        }

        if (!hasChanges) {
            logDebug('Path resolution (batch): no changes needed');
            return null;
        }

        logDebug(`Path resolution (batch): ${convertedCount}/${allImports.length} imports converted`);

        const regroupedGroups = parserInstance.organizeImportsIntoGroups(convertedImports);

        return {
            ...originalResult,
            groups: regroupedGroups
        };
    } catch (error) {
        logError('Error applying path resolution with regrouping (batch):', error);
        return null;
    }
}

// --- Main export ---

export async function formatFolder(
    folderPath: string,
    workspaceRoot: string | undefined,
    callbacks: BatchFormatCallbacks
): Promise<BatchFormatResult> {
    const result: BatchFormatResult = {
        formatted: 0,
        skipped: 0,
        errors: [],
        totalFiles: 0,
    };

    const parserCache = new Map<string, ImportParser>();
    const skipCounts: Record<string, number> = {};

    function trackSkip(reason: string, filePath: string): void {
        skipCounts[reason] = (skipCounts[reason] || 0) + 1;
        result.skipped++;
        logDebug(`  SKIP [${reason}] ${filePath}`);
    }

    try {
        // Clear ConfigLoader cache for fresh config resolution
        ConfigLoader.clearCache();
        configManager.clearDocumentCache();

        logDebug(`Batch format: discovering files in ${folderPath}`);
        const files = await discoverFiles(folderPath);
        result.totalFiles = files.length;
        logDebug(`Batch format: found ${files.length} files`);

        for (let i = 0; i < files.length; i++) {
            if (callbacks.isCancelled()) {
                logDebug(`Batch format: cancelled at file ${i + 1}/${files.length}`);
                break;
            }

            const filePath = files[i];
            const relativePath = workspaceRoot
                ? path.relative(workspaceRoot, filePath)
                : path.basename(filePath);
            callbacks.onProgress(i + 1, files.length, filePath);

            // Load config for this specific file
            let config: Config;
            try {
                const uri = callbacks.createUri(filePath);
                config = await configManager.getConfigForUri(uri);
            } catch (error) {
                logError(`Batch format: failed to load config for ${filePath}:`, error);
                config = configManager.getConfig();
            }

            // Check excluded folders
            if (isFileInExcludedFolder(filePath, config, workspaceRoot)) {
                trackSkip('excluded', relativePath);
                continue;
            }

            // Format the file
            const formatResult = await formatSingleFile(filePath, config, parserCache, workspaceRoot);

            if (formatResult.error) {
                result.errors.push({ filePath, error: formatResult.error });
                logDebug(`  ERROR ${relativePath}: ${formatResult.error}`);
            } else if (formatResult.changed) {
                result.formatted++;
                logDebug(`  FORMATTED ${relativePath}`);
            } else {
                trackSkip(formatResult.skipReason ?? 'unchanged', relativePath);
            }
        }
    } finally {
        // Dispose all cached parsers
        for (const parser of parserCache.values()) {
            parser.dispose();
        }
        parserCache.clear();
    }

    // Detailed summary
    const skipDetails = Object.entries(skipCounts)
        .map(([reason, count]) => `${reason}: ${count}`)
        .join(', ');
    logDebug(`Batch format complete: ${result.formatted} formatted, ${result.skipped} skipped (${skipDetails || 'none'}), ${result.errors.length} errors`);
    return result;
}
