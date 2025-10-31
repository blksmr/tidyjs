// Other
import { formatImports } from './formatter';
import { ImportParser, ParserResult, InvalidImport, ParsedImport, ImportSource } from './parser';

// VSCode
import { Range, window, commands, TextEdit, workspace, languages, CancellationTokenSource } from 'vscode';
import type { TextDocument, ExtensionContext, FormattingOptions, CancellationToken, DocumentFormattingEditProvider } from 'vscode';

// Utils
import { configManager } from './utils/config';
import { diagnosticsCache } from './utils/diagnostics-cache';
import { logDebug, logError } from './utils/log';
import { showMessage, analyzeImports } from './utils/misc';
import { perfMonitor } from './utils/performance';
import { PathResolver } from './utils/path-resolver';

// Node
import { writeFileSync } from 'fs';
import { join } from 'path';

let parser: ImportParser | null = null;
let lastConfigString = '';

/**
 * TidyJS Document Formatting Provider
 */
class TidyJSFormattingProvider implements DocumentFormattingEditProvider {
    async provideDocumentFormattingEdits(
        document: TextDocument,
        _options: FormattingOptions,
        _token: CancellationToken
    ): Promise<TextEdit[] | undefined> {
        try {
            // Get document-specific configuration
            const currentConfig = await configManager.getConfigForDocument(document);
            
            logDebug(`Document config loaded for ${document.fileName}:`, {
                debug: currentConfig.debug,
                groups: currentConfig.groups?.length || 0,
                formatConfig: currentConfig.format,
                singleQuote: currentConfig.format?.singleQuote,
                indent: currentConfig.format?.indent
            });
            
            // Vérifier si le document est dans un dossier exclu
            if (isDocumentInExcludedFolder(document, currentConfig)) {
                logDebug('Formatting skipped: document is in excluded folder');
                return undefined;
            }

            const documentText = document.getText();

            // Vérification de sécurité pour éviter de formater des logs
            // Supprimer cette vérification car elle est trop restrictive et empêche le formatage
            // de fichiers légitimes qui pourraient contenir ces chaînes dans leur code

            // Create or update parser with document-specific configuration
            const configString = JSON.stringify(currentConfig);
            const configChanged = configString !== lastConfigString;

            if (!parser || configChanged) {
                try {
                    // Dispose of old parser to clean up cache
                    if (parser) {
                        logDebug('Disposing old parser instance for document-specific config');
                        parser.dispose();
                    }

                    logDebug(configChanged ? 'Document config differs, creating new parser' : 'Creating new parser instance');
                    parser = new ImportParser(currentConfig);
                    lastConfigString = configString;
                } catch (error) {
                    logError('Error initializing parser with document config:', error);
                    return undefined;
                }
            }

            perfMonitor.clear();
            perfMonitor.start('total_format_operation');

            // Prepare filtering parameters for parser
            let missingModules: Set<string> | undefined;
            let unusedImportsList: string[] | undefined;
            
            logDebug('Current configuration:', {
                removeUnusedImports: currentConfig.format?.removeUnusedImports,
                removeMissingModules: currentConfig.format?.removeMissingModules,
                formatDefined: currentConfig.format !== undefined,
            });
            
            if (currentConfig.format?.removeUnusedImports === true || currentConfig.format?.removeMissingModules === true) {
                try {

                    const diagnostics = perfMonitor.measureSync('get_diagnostics', () => diagnosticsCache.getDiagnostics(document.uri), {
                        uri: document.uri.toString(),
                    });

                    // Parse once to get initial import info for filtering
                    const initialParserResult = perfMonitor.measureSync('initial_parser_parse', () => parser!.parse(documentText, undefined, undefined, document.fileName) as ParserResult, {
                        documentLength: documentText.length,
                    });

                    // Single analysis call that gets everything we need
                    const analysis = perfMonitor.measureSync(
                        'analyze_imports',
                        () => analyzeImports(document.uri, initialParserResult, diagnostics),
                        {
                            removeUnused: currentConfig.format?.removeUnusedImports,
                            removeMissing: currentConfig.format?.removeMissingModules,
                        }
                    );

                    // Prepare filtering parameters based on configuration
                    if (currentConfig.format?.removeUnusedImports === true) {
                        unusedImportsList = analysis.unusedImports;
                    }
                    
                    if (currentConfig.format?.removeMissingModules === true) {
                        missingModules = analysis.missingModules;
                        
                        // If removeUnusedImports is NOT enabled, still remove unused imports from missing modules
                        if (currentConfig.format?.removeUnusedImports !== true) {
                            unusedImportsList = Array.from(analysis.unusedFromMissing);
                        }
                    }

                    logDebug('Filtering parameters prepared:', {
                        config: {
                            removeUnusedImports: currentConfig.format?.removeUnusedImports,
                            removeMissingModules: currentConfig.format?.removeMissingModules,
                        },
                        filtering: {
                            unusedImportsList: unusedImportsList || [],
                            missingModules: missingModules ? Array.from(missingModules) : [],
                        },
                    });
                } catch (error) {
                    logError('Error preparing import filters:', error instanceof Error ? error.message : String(error));
                }
            } else {
                logDebug('Skipping import analysis - both removeUnusedImports and removeMissingModules are false');
            }
            
            // Final safety check - ensure we don't pass filtering parameters when options are disabled
            if (currentConfig.format?.removeMissingModules !== true) {
                missingModules = undefined;
            }
            if (currentConfig.format?.removeUnusedImports !== true && currentConfig.format?.removeMissingModules !== true) {
                unusedImportsList = undefined;
            }
            
            logDebug('Final filtering parameters:', {
                missingModulesSet: missingModules !== undefined,
                unusedImportsCount: unusedImportsList?.length || 0,
            });

            // Parse document with filtering - parser now handles all filtering logic
            let parserResult = perfMonitor.measureSync(
                'parser_parse',
                () => parser!.parse(documentText, missingModules, unusedImportsList, document.fileName) as ParserResult,
                { documentLength: documentText.length }
            );

            // Check if parser returned any processable imports
            if (!parserResult.importRange && parserResult.groups.length === 0) {
                logDebug('No imports to process in document');
                return undefined;
            }
            
            // Apply path resolution if enabled
            if (currentConfig.pathResolution?.enabled) {
                try {
                    const pathResolver = new PathResolver({
                        mode: currentConfig.pathResolution.mode || 'relative',
                        preferredAliases: currentConfig.pathResolution.preferredAliases || []
                    });
                    
                    const resolutionMode = currentConfig.pathResolution.mode || 'relative';
                    logDebug('Applying path resolution with mode:', resolutionMode);

                    const enhancedParserResult = await applyPathResolutionWithRegrouping(
                        parserResult,
                        pathResolver,
                        document,
                        parser!,
                        resolutionMode
                    );

                    if (enhancedParserResult) {
                        parserResult = enhancedParserResult;
                    }
                } catch (error) {
                    logError('Error during path resolution:', error);
                    // Continue without path resolution on error
                }
            }

            // Vérifier les imports invalides
            if (parserResult.invalidImports && parserResult.invalidImports.length > 0) {
                const errorMessages = parserResult.invalidImports.map((invalidImport) => {
                    return formatImportError(invalidImport);
                });
                logError('Invalid imports found:', errorMessages.join('\n'));
                return undefined;
            }

            // Debug: Log the imports before formatting
            if (currentConfig.pathResolution?.enabled) {
                logDebug('Imports before formatting:');
                parserResult.groups.forEach(group => {
                    group.imports.forEach(imp => {
                        logDebug(`  ${group.name}: ${imp.source}`);
                    });
                });
            }
            
            // Formater les imports
            const formattedDocument = await perfMonitor.measureAsync('format_imports', () =>
                formatImports(documentText, currentConfig, parserResult)
            );

            if (formattedDocument.error) {
                logError('Formatting error:', formattedDocument.error);
                return undefined;
            }


            // Créer et retourner les éditions
            const fullRange = new Range(document.positionAt(0), document.positionAt(documentText.length));

            const totalDuration = perfMonitor.end('total_format_operation');
            logDebug(`Document formatting completed in ${totalDuration.toFixed(2)}ms`);

            if (configManager.getConfig().debug) {
                perfMonitor.logSummary();
            }

            return [TextEdit.replace(fullRange, formattedDocument.text)];
        } catch (error) {
            logError('Error in provideDocumentFormattingEdits:', error);
            return undefined;
        } finally {
            diagnosticsCache.clear();
        }
    }
}

/**
 * Check if the current document is in an excluded folder
 */
function isDocumentInExcludedFolder(document: import('vscode').TextDocument, config?: import('./types').Config): boolean {
    const currentConfig = config || configManager.getConfig();
    const excludedFolders = currentConfig.excludedFolders;

    if (!excludedFolders || excludedFolders.length === 0) {
        return false;
    }

    const workspaceFolder = workspace.getWorkspaceFolder(document.uri);

    if (!workspaceFolder) {
        return false;
    }

    const relativePath = workspace.asRelativePath(document.uri, false);

    return excludedFolders.some((excludedFolder) => {
        const normalizedExcludedPath = excludedFolder.replace(/[/\\]/g, '/');
        const normalizedDocumentPath = relativePath.replace(/[/\\]/g, '/');

        return normalizedDocumentPath.startsWith(normalizedExcludedPath + '/') || normalizedDocumentPath === normalizedExcludedPath;
    });
}

/**
 * Vérifie que l'extension est activée avant d'exécuter une commande
 */
async function ensureExtensionEnabled(document?: import('vscode').TextDocument): Promise<boolean> {
    // Get document-specific config if document is provided
    const config = document ? await configManager.getConfigForDocument(document) : configManager.getParserConfig();
    
    // Validate the configuration
    const validation = configManager.validateConfiguration(config);

    if (!validation.isValid) {
        showMessage.error(
            `TidyJS extension is disabled due to configuration errors:\n${validation.errors.join(
                '\n'
            )}\n\nPlease fix your configuration to use the extension.`
        );
        return false;
    }

    // Check if configuration has changed
    const configString = JSON.stringify(config);
    const configChanged = configString !== lastConfigString;

    // Create or recreate parser if needed
    if (!parser || configChanged) {
        try {
            // Dispose of old parser to clean up cache
            if (parser) {
                logDebug('Disposing old parser instance');
                parser.dispose();
            }

            logDebug(configChanged ? 'Configuration changed, recreating parser' : 'Creating new parser instance');
            parser = new ImportParser(config);
            lastConfigString = configString;
        } catch (error) {
            logError('Error initializing parser:', error);
            showMessage.error(`Error initializing parser: ${error}`);
            return false;
        }
    }

    return true;
}

export function activate(context: ExtensionContext): void {
    try {
        // Initialize ConfigManager with context
        configManager.initialize(context);
        
        // Validate configuration on startup
        const validation = configManager.validateCurrentConfiguration();

        if (validation.isValid) {
            const config = configManager.getParserConfig();
            parser = new ImportParser(config);
            lastConfigString = JSON.stringify(config);
        } else {
            showMessage.error(
                `TidyJS extension disabled due to configuration errors:\n${validation.errors.join(
                    '\n'
                )}\n\nPlease fix your configuration to use the extension.`
            );
            logError('Extension started with invalid configuration - commands disabled:', validation.errors);
            parser = null;
        }

        // Enregistrer TidyJS comme formatting provider pour TypeScript et JavaScript
        // Note: Nous pouvons utiliser des patterns glob négatifs dans le documentSelector
        // mais ils ne sont pas encore bien supportés par VS Code pour les formatters.
        // Pour l'instant, nous gardons la vérification manuelle dans provideDocumentFormattingEdits
        const documentSelector = [
            { language: 'typescript', scheme: 'file' },
            { language: 'typescriptreact', scheme: 'file' },
            { language: 'javascript', scheme: 'file' },
            { language: 'javascriptreact', scheme: 'file' },
        ];

        const formattingProvider = languages.registerDocumentFormattingEditProvider(documentSelector, new TidyJSFormattingProvider());

        const formatCommand = commands.registerCommand('tidyjs.forceFormatDocument', async () => {
            const editor = window.activeTextEditor;
            if (!editor) {
                showMessage.warning('No active editor found');
                return;
            }

            if (!await ensureExtensionEnabled(editor.document)) {
                return;
            }

            // Forcer l'utilisation de TidyJS comme formatter pour cette exécution
            // en appelant directement notre provider
            const provider = new TidyJSFormattingProvider();
            const tokenSource = new CancellationTokenSource();
            try {
                const edits = await provider.provideDocumentFormattingEdits(
                    editor.document,
                    { tabSize: 2, insertSpaces: true },
                    tokenSource.token
                );

                if (edits && edits.length > 0) {
                    await editor.edit((editBuilder) => {
                        edits.forEach((edit) => {
                            editBuilder.replace(edit.range, edit.newText);
                        });
                    });
                    logDebug('Imports formatted successfully via command!');
                } else {
                    logDebug('No formatting changes needed');
                }
            } finally {
                tokenSource.dispose();
            }
        });

        const createConfigCommand = commands.registerCommand('tidyjs.createConfigFile', async () => {
            try {
                // Show folder picker dialog
                const folderUri = await window.showOpenDialog({
                    canSelectFolders: true,
                    canSelectFiles: false,
                    canSelectMany: false,
                    openLabel: 'Select Folder',
                    title: 'Where do you want to create the .tidyjsrc file?'
                });

                if (!folderUri || folderUri.length === 0) {
                    return; // User cancelled
                }

                const selectedFolder = folderUri[0];
                const configPath = join(selectedFolder.fsPath, '.tidyjsrc');

                // Create minimal configuration
                const minimalConfig = {
                    format: {
                        indent: 4,
                        bracketSpacing: true
                    }
                };

                // Write the configuration file
                writeFileSync(configPath, JSON.stringify(minimalConfig, null, 2));

                // Open the created file
                const document = await workspace.openTextDocument(configPath);
                await window.showTextDocument(document);

                logDebug(`Created .tidyjsrc file at: ${configPath}`);
            } catch (error) {
                logError('Error creating config file:', error);
                showMessage.error(`Failed to create config file: ${error}`);
            }
        });

        // Listen for configuration changes to invalidate parser cache
        const configChangeDisposable = workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('tidyjs')) {
                logDebug('TidyJS configuration changed, parser will be recreated on next use');
                // Force parser recreation on next use by clearing the config string
                lastConfigString = '';
                // Clear document config cache
                configManager.clearDocumentCache();
            }
        });
        
        context.subscriptions.push(formatCommand, createConfigCommand, formattingProvider, configChangeDisposable);

        logDebug('Extension activated successfully with config:', configManager.getConfig());

        if (validation.isValid) {
            logDebug('TidyJS extension is ready !');
        }
    } catch (error) {
        logError('Error activating extension:', error);
        showMessage.error(`TidyJS extension activation failed: ${error}`);
    }
}

function formatImportError(invalidImport: InvalidImport): string {
    if (!invalidImport || !invalidImport.error) {
        return 'Unknown import error';
    }

    const errorMessage = invalidImport.error;
    const importStatement = invalidImport.raw || '';
    const lineMatch = errorMessage.match(/\((\d+):(\d+)\)/);
    let formattedError = errorMessage;

    if (lineMatch && lineMatch.length >= 3) {
        const line = parseInt(lineMatch[1], 10);
        const column = parseInt(lineMatch[2], 10);

        const lines = importStatement.split('\n');

        if (line <= lines.length) {
            const problematicLine = lines[line - 1];
            const indicator = ' '.repeat(Math.max(0, column - 1)) + '^';
            formattedError = `${errorMessage}\nIn: ${problematicLine.trim()}\n${indicator}`;
        } else {
            formattedError = `${errorMessage}\nIn: ${importStatement.trim()}`;
        }
    }

    return formattedError;
}

/**
 * Apply path resolution and re-group imports based on converted paths
 * Works for both absolute and relative modes
 */
async function applyPathResolutionWithRegrouping(
    originalResult: ParserResult,
    pathResolver: PathResolver,
    document: TextDocument,
    parserInstance: ImportParser,
    _mode: 'absolute' | 'relative'
): Promise<ParserResult | null> {
    try {
        const allImports: ParsedImport[] = [];
        for (const group of originalResult.groups) {
            allImports.push(...group.imports);
        }

        const convertedImports: ParsedImport[] = [];
        let hasChanges = false;
        let convertedCount = 0;

        for (const importInfo of allImports) {
            const resolvedPath = await pathResolver.convertImportPath(
                importInfo.source,
                document
            );

            if (resolvedPath && resolvedPath !== importInfo.source) {
                const { groupName, isPriority } = parserInstance.determineGroup(resolvedPath);
                const convertedImport = {
                    ...importInfo,
                    source: resolvedPath as ImportSource,
                    groupName: groupName,
                    isPriority: isPriority
                };
                convertedImports.push(convertedImport);
                hasChanges = true;
                convertedCount++;
                logDebug(`Path resolved and regrouped: ${importInfo.source} -> ${resolvedPath} (group: ${groupName})`);
            } else {
                convertedImports.push(importInfo);
            }
        }

        if (!hasChanges) {
            logDebug('Path resolution: no changes needed');
            return null;
        }

        logDebug(`Path resolution summary: ${convertedCount}/${allImports.length} imports converted and regrouped`);

        const regroupedGroups = parserInstance.organizeImportsIntoGroups(convertedImports);

        return {
            ...originalResult,
            groups: regroupedGroups
        };
    } catch (error) {
        logError('Error applying path resolution with regrouping:', error);
        return null;
    }
}

export function deactivate(): void {
    try {
        logDebug('Extension deactivating - cleaning up resources');

        // Dispose of parser to clean up cache
        if (parser) {
            parser.dispose();
            parser = null;
        }

        // Clear configuration cache
        lastConfigString = '';

        logDebug('Extension deactivated successfully');
    } catch (error) {
        logError('Error during extension deactivation:', error);
    }
}
