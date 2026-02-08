import { workspace, Uri, TextDocument } from 'vscode';
import { UnifiedConfigLoader } from './config-loaders';
import { logDebug, logError } from './log';

export interface PathMapping {
    pattern: string;
    paths: string[];
}

export interface PathResolverConfig {
    mode: 'relative' | 'absolute';
    preferredAliases?: string[];
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

export class PathResolver {
    private configCache = new Map<string, { mappings: PathMapping[]; configType: string }>();
    private unifiedLoader = new UnifiedConfigLoader();

    constructor(private config: PathResolverConfig) {}

    /**
     * Load path mappings from any supported config file
     */
    private async loadPathMappings(document: TextDocument): Promise<PathMapping[]> {
        const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {return [];}

        const cacheKey = workspaceFolder.uri.toString();
        const cached = this.configCache.get(cacheKey);
        if (cached) {
            return [...cached.mappings];
        }

        let result;
        try {
            result = await this.unifiedLoader.loadAliases(document);
        } catch (error) {
            logError('Error loading path aliases:', error);
            return [];
        }

        if (result) {
            // Sort by specificity — most specific patterns first (defensive copy)
            const sorted = [...result.mappings].sort((a, b) =>
                patternSpecificity(b.pattern) - patternSpecificity(a.pattern)
            );

            this.configCache.set(cacheKey, {
                mappings: sorted,
                configType: result.configType
            });

            logDebug(`Loaded ${sorted.length} path mappings from ${result.configType}: ${sorted.map(m => m.pattern).join(', ')}`);

            return [...sorted];
        }

        return [];
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

    /**
     * Clear caches
     */
    public clearCache(): void {
        this.configCache.clear();
    }
    
    /**
     * Get information about the loaded config
     */
    public getConfigInfo(document: TextDocument): { type: string; path: string } | null {
        const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {return null;}
        
        const cacheKey = workspaceFolder.uri.toString();
        const cached = this.configCache.get(cacheKey);
        
        if (cached) {
            return {
                type: cached.configType,
                path: 'cached'
            };
        }
        
        return null;
    }
}
