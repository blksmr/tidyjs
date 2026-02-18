// Other
import {
    ImportType,
    ParserResult
}                           from '../parser';
import { diagnosticsCache } from './diagnostics-cache';
import { logDebug }         from './log';

// VSCode
import {
    Uri,
    window,
    languages,
    Diagnostic,
    DiagnosticSeverity
}                      from 'vscode';

const UNUSED_IMPORT_CODES = ['unused-import', 'import-not-used', '6192', '6133', '6196', '@typescript-eslint/no-unused-vars'];
const MODULE_NOT_FOUND_CODES = ['2307', '2318']; // Cannot find module

/**
 * Helper function to extract diagnostic code as string, handling both ESLint object codes and TypeScript string codes
 */
function getDiagnosticCode(diagnostic: Diagnostic): string {
    if (typeof diagnostic.code === 'string') {
        return diagnostic.code;
    }
    if (diagnostic.code && typeof diagnostic.code === 'object' && 'value' in diagnostic.code) {
        return String((diagnostic.code as { value: string | number }).value);
    }
    return String(diagnostic.code);
}

/**
 * Fonctions d'affichage de messages dans l'interface de VSCode
 * Permet d'utiliser showMessage.info(), showMessage.error() ou showMessage.warning()
 */
export const showMessage = {
    info: (message: string, timeoutOrItem?: number | string, ...items: string[]) => {
        if (typeof timeoutOrItem === 'number') { return window.setStatusBarMessage(message, timeoutOrItem); }
        const allItems = timeoutOrItem ? [timeoutOrItem, ...items] : items;
        return window.showInformationMessage(message, ...allItems);
    },

    error: (message: string, timeoutOrItem?: number | string, ...items: string[]) => {
        if (typeof timeoutOrItem === 'number') { return window.setStatusBarMessage(message, timeoutOrItem); }
        const allItems = timeoutOrItem ? [timeoutOrItem, ...items] : items;
        return window.showErrorMessage(message, ...allItems);
    },

    warning: (message: string, timeoutOrItem?: number | string, ...items: string[]) => {
        if (typeof timeoutOrItem === 'number') { return window.setStatusBarMessage(message, timeoutOrItem); }
        const allItems = timeoutOrItem ? [timeoutOrItem, ...items] : items;
        return window.showWarningMessage(message, ...allItems);
    },
};

/**
 * Supprime les imports non utilisés du résultat du parser
 * @param parserResult Résultat du parser d'imports
 * @param unusedImports Liste des imports non utilisés
 * @returns Résultat du parser mis à jour
 */
export function removeUnusedImports(parserResult: ParserResult, unusedImports: string[]): ParserResult {
    if (!unusedImports.length) {
        return parserResult;
    }

    const updatedResult = { ...parserResult };

    updatedResult.groups = parserResult.groups
        .map((group) => {
            const updatedGroup = { ...group };

            updatedGroup.imports = group.imports
                .map((importItem) => {
                    // Create a copy of the import item
                    const updatedImport = { ...importItem };

                    // Filter out unused specifiers
                    if (updatedImport.specifiers && updatedImport.specifiers.length) {
                        updatedImport.specifiers = updatedImport.specifiers.filter((specifier) => {
                            const specName = typeof specifier === 'string' ? specifier : specifier.local;
                            return !unusedImports.includes(specName);
                        });
                    }

                    // Check if default import is unused
                    if (updatedImport.defaultImport && unusedImports.includes(updatedImport.defaultImport)) {
                        updatedImport.defaultImport = undefined;
                        // For default imports, remove the specifier that contains the default import name
                        updatedImport.specifiers = updatedImport.specifiers.filter((specifier) => {
                            const specName = typeof specifier === 'string' ? specifier : specifier.local;
                            return !unusedImports.includes(specName);
                        });
                    }

                    return updatedImport;
                })
                .filter((importItem) => {
                    // Remove the entire import if:
                    // 1. No specifiers left AND no default import
                    // 2. It's a side-effect import (no specifiers, no default) - keep these always
                    if (importItem.type === ImportType.SIDE_EFFECT) {
                        return true; // Always keep side-effect imports
                    }

                    const hasSpecifiers = importItem.specifiers && importItem.specifiers.length > 0;
                    const hasDefault = importItem.defaultImport;

                    return hasSpecifiers || hasDefault;
                });

            return updatedGroup;
        })
        .filter((group) => group.imports.length > 0); // Remove empty groups

    return updatedResult;
}

/**
 * Unified function to analyze imports and get both unused imports and missing modules
 * This avoids duplication of diagnostic processing
 */
export function analyzeImports(
    uri: Uri,
    parserResult: ParserResult,
    diagnostics?: ReturnType<typeof diagnosticsCache.getDiagnostics>
): {
    unusedImports: string[];
    missingModules: Set<string>;
    unusedFromMissing: Set<string>;
} {
    try {
        // Quick safety check
        if (!languages || typeof languages.getDiagnostics !== 'function') {
            logDebug('VS Code APIs not available for diagnostic retrieval');
            return {
                unusedImports: [],
                missingModules: new Set(),
                unusedFromMissing: new Set(),
            };
        }

        const cachedDiagnostics = diagnostics || diagnosticsCache.getDiagnostics(uri);
        const missingModules = new Set<string>();
        const unusedVariables = new Set<string>();

        logDebug(`analyzeImports: Processing ${cachedDiagnostics?.length || 0} diagnostics for ${uri.toString()}`);

        if (!cachedDiagnostics || cachedDiagnostics.length === 0) {
            logDebug('No diagnostics available for import analysis');
            return {
                unusedImports: [],
                missingModules: new Set(),
                unusedFromMissing: new Set(),
            };
        }

        // Single pass through diagnostics to collect all information
        for (const diagnostic of cachedDiagnostics) {
            logDebug(`Diagnostic: severity=${diagnostic.severity}, code=${getDiagnosticCode(diagnostic)}, message="${diagnostic.message}"`);

            // Check for missing modules
            if (diagnostic.severity === DiagnosticSeverity.Error && MODULE_NOT_FOUND_CODES.includes(getDiagnosticCode(diagnostic))) {
                const message = diagnostic.message;
                const moduleMatch = message.match(/Cannot find module ['"]([^'"]+)['"]/);

                if (moduleMatch && moduleMatch[1]) {
                    missingModules.add(moduleMatch[1]);
                    logDebug(`Found missing module: ${moduleMatch[1]}`);
                }
            }

            // Check for unused variables
            if (
                (diagnostic.severity === DiagnosticSeverity.Error || diagnostic.severity === DiagnosticSeverity.Warning || diagnostic.severity === DiagnosticSeverity.Hint) &&
                UNUSED_IMPORT_CODES.includes(getDiagnosticCode(diagnostic))
            ) {
                const match = diagnostic.message.match(/'([^']+)' is (?:declared|defined) but (?:its value is )?never (?:read|used)\.?/);
                if (match && match[1]) {
                    unusedVariables.add(match[1]);
                    logDebug(`Unused variable detected: ${match[1]}`);
                }
            }
        }

        // Collect all imported names
        const allImportedNames: string[] = [];
        for (const group of parserResult.groups) {
            for (const imp of group.imports) {
                // For default imports, only use the defaultImport field to avoid duplication
                if (imp.defaultImport && imp.type === ImportType.DEFAULT) {
                    allImportedNames.push(imp.defaultImport);
                } else {
                    // For other import types (named, type, etc.), use specifiers
                    for (const spec of imp.specifiers) {
                        const specName = typeof spec === 'string' ? spec : spec.local;
                        allImportedNames.push(specName);
                    }
                }
            }
        }

        // Filter unused variables to only include those that are imported
        const unusedImports = Array.from(unusedVariables).filter((name) => allImportedNames.includes(name));

        // Find which unused variables come from missing modules
        const unusedFromMissing = new Set<string>();

        logDebug('Missing modules detected:', Array.from(missingModules));
        logDebug('Unused imports detected:', unusedImports);

        for (const group of parserResult.groups) {
            for (const imp of group.imports) {
                if (missingModules.has(imp.source)) {
                    logDebug(`Import from missing module ${imp.source}:`, imp.specifiers);

                    for (const specifier of imp.specifiers) {
                        const specName = typeof specifier === 'string' ? specifier : specifier.local;
                        if (unusedVariables.has(specName)) {
                            unusedFromMissing.add(specName);
                            logDebug(`  - ${specName} is unused and from missing module`);
                        }
                    }

                    if (imp.defaultImport && unusedVariables.has(imp.defaultImport)) {
                        unusedFromMissing.add(imp.defaultImport);
                        logDebug(`  - Default import ${imp.defaultImport} is unused and from missing module`);
                    }
                }
            }
        }

        logDebug('Final analysis results:', {
            unusedImports,
            missingModules: Array.from(missingModules),
            unusedFromMissing: Array.from(unusedFromMissing),
        });

        return {
            unusedImports,
            missingModules,
            unusedFromMissing,
        };
    } catch (error) {
        console.warn('Error analyzing imports:', error);
        return {
            unusedImports: [],
            missingModules: new Set(),
            unusedFromMissing: new Set(),
        };
    }
}
