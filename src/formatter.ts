import type { ParsedImport, ParserResult } from './parser';

import { logDebug, logError } from './utils/log';
import { showMessage } from './utils/misc';
import { buildDocument } from './ir/builders';
import { printDocument } from './ir/printer';

import type { Config } from './types';

function replaceImportLines(sourceText: string, importRange: { start: number; end: number }, formattedImports: string, config: Config): string {
    const lines = sourceText.split('\n');
    const enforce = config.format?.enforceNewlineAfterImports !== false;

    // Find line numbers corresponding to importRange more precisely
    let startLine = 0;
    let endLine = 0;
    let currentPos = 0;

    for (let i = 0; i < lines.length; i++) {
        const lineEnd = currentPos + lines[i].length;

        // Find the first line that contains or starts after importRange.start
        if (currentPos <= importRange.start && importRange.start <= lineEnd) {
            startLine = i;
        }

        // Find the last line that contains or ends before importRange.end
        if (currentPos <= importRange.end && importRange.end <= lineEnd + 1) {
            // +1 to include newline
            endLine = i;
        }

        currentPos = lineEnd + 1; // +1 for the \n
    }

    // Replace complete lines - include all lines from startLine to endLine inclusive
    const beforeLines = lines.slice(0, startLine);
    const afterLines = lines.slice(endLine + 1);

    // Handle formatted imports
    let newImportLines: string[] = [];
    if (formattedImports.trim()) {
        newImportLines = formattedImports.split('\n');

        if (afterLines.length > 0) {
            if (enforce) {
                // Remove any leading empty lines from afterLines to avoid double spacing
                while (afterLines.length > 0 && afterLines[0].trim() === '') {
                    afterLines.shift();
                }
            }
            // When not enforcing, preserve afterLines as-is
        } else {
            // File ends with imports - add an extra empty line for proper file ending
            newImportLines.push('');
        }
    } else {
        // No imports - ensure clean transition
        if (afterLines.length > 0) {
            // Remove excessive empty lines at the start of afterLines
            while (afterLines.length > 0 && afterLines[0].trim() === '') {
                afterLines.shift();
            }

            // If file doesn't start with imports, maintain spacing
            if (beforeLines.length > 0 && afterLines.length > 0) {
                // Check if we need a separator line
                const lastBeforeLine = beforeLines[beforeLines.length - 1];
                const firstAfterLine = afterLines[0];

                if (lastBeforeLine && lastBeforeLine.trim() !== '' && firstAfterLine && firstAfterLine.trim() !== '') {
                    newImportLines = [''];
                }
            }
        }
    }

    return [...beforeLines, ...newImportLines, ...afterLines].join('\n');
}

function formatImportsFromParser(
    sourceText: string,
    importRange: { start: number; end: number },
    parserResult: ParserResult,
    config: Config
): string {
    if (importRange.start === importRange.end) {
        return sourceText;
    }

    // Check if parser filtered out all imports - if so, remove the import section
    const hasImports = parserResult.groups.some((group) => group.imports.length > 0);
    if (!hasImports) {
        logDebug('No imports remain after parser filtering, removing import section');
        return replaceImportLines(sourceText, importRange, '', config);
    }

    try {
        const currentImportText = sourceText.substring(importRange.start, importRange.end);

        const dynamicImportTest = /import\(|await\s+import/;
        if (dynamicImportTest.test(currentImportText)) {
            throw new Error('Dynamic imports detected in the static imports section');
        }

        // Build sorted group list from parser result
        const importsByGroup: Record<string, { order: number; imports: ParsedImport[] }> = {};

        parserResult.groups.forEach((group) => {
            if (group.imports?.length) {
                importsByGroup[group.name] = {
                    order: group.order,
                    imports: group.imports,
                };
            }
        });

        const importGroupEntries = Object.entries(importsByGroup);
        importGroupEntries.sort(([, a], [, b]) => a.order - b.order);

        const groups = importGroupEntries.map(([name, { imports }]) => ({ name, imports }));

        // Build IR document and print
        const irDocument = buildDocument(groups, config);
        const formattedText = printDocument(irDocument);

        return replaceImportLines(sourceText, importRange, formattedText, config);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logDebug(`Error while formatting imports: ${errorMessage}`);
        throw error;
    }
}

async function formatImports(sourceText: string, config: Config, parserResult?: ParserResult): Promise<{ text: string; error?: string }> {
    if (!parserResult) {
        logDebug('No parser result provided, unable to format imports');
        return { text: sourceText };
    }

    if (parserResult.invalidImports && parserResult.invalidImports.length > 0) {
        return {
            text: sourceText,
            error: parserResult.invalidImports[0].error,
        };
    }

    const importRange = parserResult.importRange;
    if (!importRange || importRange.start === importRange.end) {
        return { text: sourceText };
    }

    try {
        const formattedText = formatImportsFromParser(sourceText, importRange, parserResult, config);

        return { text: formattedText };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        showMessage.error(`An error occurred while formatting imports: ${errorMessage}`);
        logError(`An error occurred while formatting imports: ${errorMessage}`);
        throw new Error(errorMessage);
    }
}

export { formatImports };
