import * as fs from 'fs';
import * as nodePath from 'path';

import { workspace, Uri, TextDocument } from 'vscode';
import { logDebug, logError } from './log';

export interface PathMapping {
    pattern: string;
    paths: string[];
}

export interface PathResolverConfig {
    mode: 'relative' | 'absolute';
    preferredAliases?: string[];
    aliases?: Record<string, string[]>;
}

/**
 * Compute a specificity score for a path mapping pattern.
 * Higher score = more specific. Accounts for fixed segments count,
 * pattern length, and wildcard count.
 */
function patternSpecificity(pattern: string): number {
    const wildcards = (pattern.match(/\*/g) || []).length;
    const fixedSegments = pattern.replace(/\*/g, '').split('/').filter(Boolean).length;
    // Fixed segments weigh most, then total length, then fewer wildcards
    return fixedSegments * 1000 + pattern.length * 10 - wildcards;
}

function safeRegExp(pattern: string): RegExp | null {
    try {
        return new RegExp(pattern);
    } catch {
        logError(`Invalid regex pattern: ${pattern}`);
        return null;
    }
}

/**
 * Extract path mappings from a parsed tsconfig/jsconfig JSON object.
 */
export function extractTsConfigPaths(configPath: string, config: unknown): PathMapping[] {
    const mappings: PathMapping[] = [];

    if (!config || typeof config !== 'object') { return mappings; }
    const tsConfig = config as { compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> } };
    if (!tsConfig.compilerOptions) { return mappings; }

    const baseUrl = tsConfig.compilerOptions.baseUrl || '.';
    const configUri = Uri.file(configPath);
    const configDir = Uri.joinPath(configUri, '..');
    const absoluteBaseUrl = Uri.joinPath(configDir, baseUrl);

    if (tsConfig.compilerOptions.paths && Object.keys(tsConfig.compilerOptions.paths).length > 0) {
        for (const [pattern, paths] of Object.entries(tsConfig.compilerOptions.paths)) {
            mappings.push({
                pattern,
                paths: paths.map(p => Uri.joinPath(absoluteBaseUrl, p).fsPath)
            });
        }
    } else if (tsConfig.compilerOptions.baseUrl) {
        mappings.push({
            pattern: '*',
            paths: [Uri.joinPath(absoluteBaseUrl, '*').fsPath]
        });
        logDebug(`Using baseUrl fallback mapping: * -> ${absoluteBaseUrl.fsPath}/*`);
    }

    return mappings;
}

/**
 * Walk up from the document directory to the workspace root,
 * looking for tsconfig.json / jsconfig.json and extracting path mappings.
 */
async function loadTsConfigMappings(document: TextDocument): Promise<PathMapping[]> {
    const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) { return []; }

    let currentUri = Uri.joinPath(document.uri, '..');
    const rootUri = workspaceFolder.uri;

    while (currentUri.fsPath.startsWith(rootUri.fsPath)) {
        for (const name of ['tsconfig.json', 'jsconfig.json']) {
            const configUri = Uri.joinPath(currentUri, name);
            try {
                const bytes = await workspace.fs.readFile(configUri);
                const content = Buffer.from(bytes).toString('utf-8');
                const json = JSON.parse(
                    content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').replace(/,(\s*[}\]])/g, '$1')
                );
                const mappings = extractTsConfigPaths(configUri.fsPath, json);
                if (mappings.length > 0) { return mappings; }
            } catch {
                // File doesn't exist or JSON is invalid — continue searching
            }
        }
        const parent = Uri.joinPath(currentUri, '..');
        if (parent.fsPath === currentUri.fsPath) { break; }
        currentUri = parent;
    }
    return [];
}

/**
 * Extract path mappings from a parsed tsconfig/jsconfig JSON object (pure Node.js, no VS Code APIs).
 */
export function extractTsConfigPathsFs(configPath: string, config: unknown): PathMapping[] {
    const mappings: PathMapping[] = [];

    if (!config || typeof config !== 'object') { return mappings; }
    const tsConfig = config as { compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> } };
    if (!tsConfig.compilerOptions) { return mappings; }

    const baseUrl = tsConfig.compilerOptions.baseUrl || '.';
    const configDir = nodePath.dirname(configPath);
    const absoluteBaseUrl = nodePath.resolve(configDir, baseUrl);

    if (tsConfig.compilerOptions.paths && Object.keys(tsConfig.compilerOptions.paths).length > 0) {
        for (const [pattern, paths] of Object.entries(tsConfig.compilerOptions.paths)) {
            mappings.push({
                pattern,
                paths: paths.map(p => nodePath.resolve(absoluteBaseUrl, p))
            });
        }
    } else if (tsConfig.compilerOptions.baseUrl) {
        mappings.push({
            pattern: '*',
            paths: [nodePath.resolve(absoluteBaseUrl, '*')]
        });
        logDebug(`Using baseUrl fallback mapping: * -> ${absoluteBaseUrl}/*`);
    }

    return mappings;
}

/**
 * Walk up from the file directory to the workspace root,
 * looking for tsconfig.json / jsconfig.json (pure Node.js, no VS Code APIs).
 */
function loadTsConfigMappingsFromFs(filePath: string, workspaceRoot: string): PathMapping[] {
    let currentDir = nodePath.dirname(filePath);

    while (currentDir.startsWith(workspaceRoot)) {
        for (const name of ['tsconfig.json', 'jsconfig.json']) {
            const configPath = nodePath.join(currentDir, name);
            try {
                const content = fs.readFileSync(configPath, 'utf-8');
                const json = JSON.parse(
                    content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').replace(/,(\s*[}\]])/g, '$1')
                );
                const mappings = extractTsConfigPathsFs(configPath, json);
                if (mappings.length > 0) { return mappings; }
            } catch {
                // File doesn't exist or JSON is invalid — continue searching
            }
        }
        const parent = nodePath.dirname(currentDir);
        if (parent === currentDir) { break; }
        currentDir = parent;
    }
    return [];
}

export class PathResolver {
    private configCache = new Map<string, PathMapping[]>();

    constructor(private config: PathResolverConfig) {}

    /**
     * Load path mappings from .tidyjsrc aliases (priority) and tsconfig (fallback).
     */
    private async loadPathMappings(document: TextDocument): Promise<PathMapping[]> {
        const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) { return []; }

        const cacheKey = workspaceFolder.uri.toString();
        const cached = this.configCache.get(cacheKey);
        if (cached) { return [...cached]; }

        const allMappings: PathMapping[] = [];

        // 1. .tidyjsrc / VS Code settings aliases (high priority)
        if (this.config.aliases) {
            for (const [pattern, paths] of Object.entries(this.config.aliases)) {
                allMappings.push({ pattern, paths });
            }
        }

        // 2. tsconfig.json / jsconfig.json (low priority)
        try {
            const tsMappings = await loadTsConfigMappings(document);
            const existing = new Set(allMappings.map(m => m.pattern));
            for (const m of tsMappings) {
                if (!existing.has(m.pattern)) { allMappings.push(m); }
            }
        } catch (error) {
            logError('Error loading tsconfig paths:', error);
        }

        const sorted = [...allMappings].sort((a, b) =>
            patternSpecificity(b.pattern) - patternSpecificity(a.pattern)
        );

        this.configCache.set(cacheKey, sorted);

        logDebug(`Loaded ${sorted.length} path mappings: ${sorted.map(m => m.pattern).join(', ')}`);

        return [...sorted];
    }

    /**
     * Convert an import path based on the configured mode
     */
    public async convertImportPath(
        importPath: string,
        document: TextDocument
    ): Promise<string | null> {
        const isRelativePath = importPath.startsWith('.');

        // In relative mode, already-relative imports should be left untouched
        if (this.config.mode === 'relative' && isRelativePath) {
            return null;
        }

        const mappings = await this.loadPathMappings(document);
        if (mappings.length === 0) {
            logDebug(`No path mappings found for ${importPath}`);
            return null;
        }

        const isPotentialAlias = importPath.startsWith('@') || importPath.startsWith('~');

        const matchesAlias = mappings.some(mapping => this.matchesPattern(importPath, mapping.pattern));

        if (!isRelativePath && !isPotentialAlias && !matchesAlias) {
            return null;
        }

        if (this.config.mode === 'absolute') {
            return this.convertToAbsolute(importPath, document, mappings);
        } else {
            return await this.convertToRelative(importPath, document, mappings);
        }
    }

    /**
     * Convert relative or aliased path to absolute (with alias)
     */
    private convertToAbsolute(
        importPath: string,
        document: TextDocument,
        mappings: PathMapping[]
    ): string | null {
        if (importPath.startsWith('.')) {
            const documentDir = Uri.joinPath(document.uri, '..');
            const absoluteUri = Uri.joinPath(documentDir, importPath);
            const absolutePath = absoluteUri.fsPath;

            logDebug(`Converting relative to absolute: ${importPath}`);
            logDebug(`  Document dir: ${documentDir.fsPath}`);
            logDebug(`  Absolute path: ${absolutePath}`);

            for (const mapping of mappings) {
                logDebug(`  Trying mapping pattern: ${mapping.pattern} → ${mapping.paths.join(', ')}`);

                for (const mappedPath of mapping.paths) {
                    const mappedPattern = mappedPath
                        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                        .replace(/\*/g, '(.*?)');
                    const regex = safeRegExp(`^${mappedPattern}$`);
                    if (!regex) { continue; }

                    logDebug(`    Regex pattern: ^${mappedPattern}$`);
                    const match = absolutePath.match(regex);

                    if (match) {
                        let captureIndex = 1;
                        const aliasPath = mapping.pattern.replace(/\*/g, () => {
                            const captured = match[captureIndex++] || '';
                            return captured.replace(/(\.d\.(?:cts|mts|ts)|\.(?:tsx?|jsx?))$/, '');
                        });

                        const isValidAlias = aliasPath.startsWith('@') ||
                                           aliasPath.startsWith('~') ||
                                           aliasPath.includes('/');

                        if (!isValidAlias) {
                            logDebug(`    ⚠️ Skipping invalid alias (no prefix): ${aliasPath}`);
                            continue;
                        }

                        logDebug(`    ✅ Matched! Captured: ${match.slice(1).join(', ')}`);
                        logDebug(`Converted relative to alias: ${importPath} → ${aliasPath}`);
                        return aliasPath;
                    } else {
                        logDebug(`    ❌ No match`);
                    }
                }
            }

            logDebug(`  No mapping matched for: ${absolutePath}`);
        } else {
            for (const mapping of mappings) {
                if (this.matchesPattern(importPath, mapping.pattern)) {
                    logDebug(`Import ${importPath} already matches alias pattern ${mapping.pattern}`);
                    return null;
                }
            }
        }

        return null;
    }

    /**
     * Convert absolute (aliased) path to relative
     */
    private async convertToRelative(
        importPath: string,
        document: TextDocument,
        mappings: PathMapping[]
    ): Promise<string | null> {

        for (const mapping of mappings) {
            if (this.matchesPattern(importPath, mapping.pattern)) {
                logDebug(`Import ${importPath} matches pattern ${mapping.pattern}`);

                const resolvedPath = await this.resolveAliasToPathWithFallbacks(importPath, mapping);
                if (resolvedPath) {
                    if (resolvedPath.includes('node_modules')) {
                        logDebug(`Skipping ${importPath}: resolves to node_modules`);
                        continue;
                    }

                    const documentDir = Uri.joinPath(document.uri, '..');
                    let relativePath = this.getRelativePath(documentDir, Uri.file(resolvedPath));

                    if (!relativePath.startsWith('.')) {
                        relativePath = './' + relativePath;
                    }

                    return relativePath;
                }
            }
        }

        return null;
    }

    /**
     * Check if an import path matches a pattern
     */
    private matchesPattern(importPath: string, pattern: string): boolean {
        const regexPattern = pattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*');
        const regex = safeRegExp(`^${regexPattern}$`);
        return regex ? regex.test(importPath) : false;
    }

    /**
     * Resolve an aliased import to an absolute file path with fallback support
     * Tries all paths in mapping.paths and returns the first that exists
     */
    private async resolveAliasToPathWithFallbacks(importPath: string, mapping: PathMapping): Promise<string | null> {
        const pattern = mapping.pattern;
        const regexPattern = pattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '(.*?)');
        const regex = safeRegExp(`^${regexPattern}$`);
        if (!regex) { return null; }
        const match = importPath.match(regex);

        if (match && mapping.paths.length > 0) {
            for (const pathTemplate of mapping.paths) {
                let resolvedPath = pathTemplate;
                let captureIndex = 1;

                resolvedPath = resolvedPath.replace(/\*/g, () => {
                    return match[captureIndex++] || '';
                });

                const pathWithoutExt = resolvedPath.replace(/(\.d\.(?:cts|mts|ts)|\.(?:tsx?|jsx?))$/, '');

                const fileExists = await this.checkFileExists(Uri.file(pathWithoutExt));
                if (fileExists) {
                    logDebug(`Resolved ${importPath} to ${pathWithoutExt} (tried ${mapping.paths.indexOf(pathTemplate) + 1}/${mapping.paths.length} paths)`);
                    return pathWithoutExt;
                }

                logDebug(`Path does not exist: ${pathWithoutExt}, trying next fallback...`);
            }

            logDebug(`All ${mapping.paths.length} fallback paths failed for ${importPath}`);
        }

        return null;
    }

    /**
     * Calculate relative path between two URIs
     */
    private getRelativePath(fromUri: Uri, toUri: Uri): string {
        const fromParts = fromUri.fsPath.split(/[/\\]/).filter(p => p.length > 0);
        const toParts = toUri.fsPath.split(/[/\\]/).filter(p => p.length > 0);

        // Find common base
        let commonLength = 0;
        for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
            if (fromParts[i] === toParts[i]) {
                commonLength++;
            } else {
                break;
            }
        }

        // Build relative path
        const upCount = fromParts.length - commonLength;
        const downPath = toParts.slice(commonLength);

        const parts: string[] = [];
        for (let i = 0; i < upCount; i++) {
            parts.push('..');
        }
        parts.push(...downPath);

        const result = parts.join('/') || '.';

        return result;
    }

    /**
     * Check if a file or directory exists
     */
    private async checkFileExists(uri: Uri): Promise<boolean> {
        const possibleExtensions = [
            '',
            '.ts',
            '.tsx',
            '.js',
            '.jsx',
            '.d.ts',
            '.d.cts',
            '.d.mts',
            '/index.ts',
            '/index.tsx',
            '/index.js',
            '/index.jsx',
            '/index.d.ts',
            '/index.d.cts',
            '/index.d.mts'
        ];

        for (const ext of possibleExtensions) {
            try {
                const testUri = Uri.file(uri.fsPath + ext);
                await workspace.fs.stat(testUri);
                return true;
            } catch {
                // File doesn't exist with this extension, try next
            }
        }

        return false;
    }

    // ─── Batch-mode methods (pure Node.js, no VS Code APIs) ───

    /**
     * Load path mappings from .tidyjsrc aliases (priority) and tsconfig (fallback).
     * Uses Node.js fs instead of VS Code workspace APIs.
     */
    private loadPathMappingsBatch(filePath: string, workspaceRoot: string): PathMapping[] {
        const cacheKey = workspaceRoot;
        const cached = this.configCache.get(cacheKey);
        if (cached) { return [...cached]; }

        const allMappings: PathMapping[] = [];

        // 1. .tidyjsrc / config aliases (high priority)
        if (this.config.aliases) {
            for (const [pattern, paths] of Object.entries(this.config.aliases)) {
                allMappings.push({ pattern, paths });
            }
        }

        // 2. tsconfig.json / jsconfig.json (low priority)
        try {
            const tsMappings = loadTsConfigMappingsFromFs(filePath, workspaceRoot);
            const existing = new Set(allMappings.map(m => m.pattern));
            for (const m of tsMappings) {
                if (!existing.has(m.pattern)) { allMappings.push(m); }
            }
        } catch (error) {
            logError('Error loading tsconfig paths (batch):', error);
        }

        const sorted = [...allMappings].sort((a, b) =>
            patternSpecificity(b.pattern) - patternSpecificity(a.pattern)
        );

        this.configCache.set(cacheKey, sorted);
        logDebug(`Loaded ${sorted.length} path mappings (batch): ${sorted.map(m => m.pattern).join(', ')}`);

        return [...sorted];
    }

    /**
     * Convert an import path based on the configured mode (batch, no VS Code APIs).
     */
    public convertImportPathBatch(
        importPath: string,
        filePath: string,
        workspaceRoot: string
    ): string | null {
        const isRelativePath = importPath.startsWith('.');

        if (this.config.mode === 'relative' && isRelativePath) {
            return null;
        }

        const mappings = this.loadPathMappingsBatch(filePath, workspaceRoot);
        if (mappings.length === 0) {
            logDebug(`No path mappings found for ${importPath}`);
            return null;
        }

        const isPotentialAlias = importPath.startsWith('@') || importPath.startsWith('~');
        const matchesAlias = mappings.some(mapping => this.matchesPattern(importPath, mapping.pattern));

        if (!isRelativePath && !isPotentialAlias && !matchesAlias) {
            return null;
        }

        if (this.config.mode === 'absolute') {
            return this.convertToAbsoluteBatch(importPath, filePath, mappings);
        } else {
            return this.convertToRelativeBatch(importPath, filePath, mappings);
        }
    }

    /**
     * Convert relative or aliased path to absolute (batch, no VS Code APIs).
     */
    private convertToAbsoluteBatch(
        importPath: string,
        filePath: string,
        mappings: PathMapping[]
    ): string | null {
        if (importPath.startsWith('.')) {
            const documentDir = nodePath.dirname(filePath);
            const absolutePath = nodePath.resolve(documentDir, importPath);

            for (const mapping of mappings) {
                for (const mappedPath of mapping.paths) {
                    const mappedPattern = mappedPath
                        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                        .replace(/\*/g, '(.*?)');
                    const regex = safeRegExp(`^${mappedPattern}$`);
                    if (!regex) { continue; }

                    const match = absolutePath.match(regex);
                    if (match) {
                        let captureIndex = 1;
                        const aliasPath = mapping.pattern.replace(/\*/g, () => {
                            const captured = match[captureIndex++] || '';
                            return captured.replace(/(\.d\.(?:cts|mts|ts)|\.(?:tsx?|jsx?))$/, '');
                        });

                        const isValidAlias = aliasPath.startsWith('@') ||
                                           aliasPath.startsWith('~') ||
                                           aliasPath.includes('/');

                        if (!isValidAlias) { continue; }

                        logDebug(`Converted relative to alias (batch): ${importPath} → ${aliasPath}`);
                        return aliasPath;
                    }
                }
            }
        } else {
            for (const mapping of mappings) {
                if (this.matchesPattern(importPath, mapping.pattern)) {
                    return null;
                }
            }
        }

        return null;
    }

    /**
     * Convert absolute (aliased) path to relative (batch, no VS Code APIs).
     */
    private convertToRelativeBatch(
        importPath: string,
        filePath: string,
        mappings: PathMapping[]
    ): string | null {
        for (const mapping of mappings) {
            if (this.matchesPattern(importPath, mapping.pattern)) {
                const resolvedPath = this.resolveAliasToPathWithFallbacksFs(importPath, mapping);
                if (resolvedPath) {
                    if (resolvedPath.includes('node_modules')) { continue; }

                    const documentDir = nodePath.dirname(filePath);
                    let relativePath = this.getRelativePathFs(documentDir, resolvedPath);

                    if (!relativePath.startsWith('.')) {
                        relativePath = './' + relativePath;
                    }

                    return relativePath;
                }
            }
        }

        return null;
    }

    /**
     * Resolve an aliased import to an absolute file path (batch, fs.existsSync).
     */
    private resolveAliasToPathWithFallbacksFs(importPath: string, mapping: PathMapping): string | null {
        const pattern = mapping.pattern;
        const regexPattern = pattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '(.*?)');
        const regex = safeRegExp(`^${regexPattern}$`);
        if (!regex) { return null; }
        const match = importPath.match(regex);

        if (match && mapping.paths.length > 0) {
            for (const pathTemplate of mapping.paths) {
                let resolvedPath = pathTemplate;
                let captureIndex = 1;

                resolvedPath = resolvedPath.replace(/\*/g, () => {
                    return match[captureIndex++] || '';
                });

                const pathWithoutExt = resolvedPath.replace(/(\.d\.(?:cts|mts|ts)|\.(?:tsx?|jsx?))$/, '');

                if (this.checkFileExistsFs(pathWithoutExt)) {
                    logDebug(`Resolved ${importPath} to ${pathWithoutExt} (batch)`);
                    return pathWithoutExt;
                }
            }
        }

        return null;
    }

    /**
     * Calculate relative path between two directory/file paths (pure strings).
     */
    private getRelativePathFs(fromDir: string, toPath: string): string {
        const fromParts = fromDir.split(/[/\\]/).filter(p => p.length > 0);
        const toParts = toPath.split(/[/\\]/).filter(p => p.length > 0);

        let commonLength = 0;
        for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
            if (fromParts[i] === toParts[i]) {
                commonLength++;
            } else {
                break;
            }
        }

        const upCount = fromParts.length - commonLength;
        const downPath = toParts.slice(commonLength);

        const parts: string[] = [];
        for (let i = 0; i < upCount; i++) {
            parts.push('..');
        }
        parts.push(...downPath);

        return parts.join('/') || '.';
    }

    /**
     * Check if a file or directory exists (batch, fs.existsSync).
     */
    private checkFileExistsFs(basePath: string): boolean {
        const possibleExtensions = [
            '',
            '.ts',
            '.tsx',
            '.js',
            '.jsx',
            '.d.ts',
            '.d.cts',
            '.d.mts',
            '/index.ts',
            '/index.tsx',
            '/index.js',
            '/index.jsx',
            '/index.d.ts',
            '/index.d.cts',
            '/index.d.mts'
        ];

        for (const ext of possibleExtensions) {
            if (fs.existsSync(basePath + ext)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Clear caches
     */
    public clearCache(): void {
        this.configCache.clear();
    }
}
