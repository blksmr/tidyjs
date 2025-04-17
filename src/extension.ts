// Misc
import { formatImports, findImportsRange, needsFormatting } from './formatter';

// Parser
import { ImportParser, ParserResult, InvalidImport } from 'tidyjs-parser';

// VSCode
import { Range, window, commands, workspace, languages, DiagnosticSeverity, Uri } from 'vscode';
import type { ExtensionContext } from 'vscode';

// Utils
import { configManager } from './utils/config';
import { logDebug, logError } from './utils/log';
import { showMessage } from './utils/misc';

let parser = new ImportParser(configManager.getParserConfig());

const UNUSED_IMPORT_CODES = ['unused-import', 'import-not-used', '6192', '6133'];

/**
 * Récupère les imports non utilisés à partir des diagnostics
 * @param document Document actuel
 * @returns Un tableau des noms d'imports non utilisés
 */
function getUnusedImports(uri: Uri): string[] {
  const unusedImports: string[] = [];
  
  const diagnostics = languages.getDiagnostics(uri);
  
  const unusedImportDiagnostics = diagnostics.filter(diagnostic => {
    return (
      diagnostic.severity === DiagnosticSeverity.Warning || 
      diagnostic.severity === DiagnosticSeverity.Hint
    ) && (
      UNUSED_IMPORT_CODES.some(code => diagnostic.code === code) ||
      diagnostic.message.toLowerCase().includes('unused import') ||
      diagnostic.message.toLowerCase().includes('is declared but')
    );
  });
  
  for (const diagnostic of unusedImportDiagnostics) {
    const message = diagnostic.message;
    
    const importMatch = message.match(/'([^']+)'/) || message.match(/"([^"]+)"/);
    if (importMatch && importMatch[1]) {
      unusedImports.push(importMatch[1]);
    }
  }
  
  logDebug('Unused imports found:', unusedImports);
  return unusedImports;
}

/**
 * Supprime les imports non utilisés du résultat du parser
 * @param parserResult Résultat du parser d'imports
 * @param unusedImports Liste des imports non utilisés
 * @returns Résultat du parser mis à jour
 */
function removeUnusedImports(parserResult: ParserResult, unusedImports: string[]): ParserResult {
  if (!unusedImports.length) {
    return parserResult;
  }
  
  const updatedResult = { ...parserResult };
  
  updatedResult.groups = parserResult.groups.map(group => {
    const updatedGroup = { ...group };
    
    updatedGroup.imports = group.imports.filter(importItem => {
      const importName = importItem.source;
      
      if (unusedImports.includes(importName)) {
        return false;
      }
      
      if (importItem.specifiers && importItem.specifiers.length) {
        importItem.specifiers = importItem.specifiers.filter(
          specifier => !unusedImports.includes(specifier)
        );
        
        return importItem.specifiers.length > 0;
      }
      
      return true;
    });
    
    return updatedGroup;
  });
  
  return updatedResult;
}

export function activate(context: ExtensionContext): void {
  try {
    configManager.loadConfiguration();

    workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('tidyjs')) {
        configManager.loadConfiguration();
        parser = new ImportParser(configManager.getParserConfig());
      }
    });

    const formatImportsCommand = commands.registerCommand('extension.format', async () => {
      const editor = window.activeTextEditor;
      if (!editor) {
        showMessage.warning('No active editor found');
        return;
      }

      const document = editor.document;
      const documentText = document.getText();
      const importRange = findImportsRange(documentText);
      if (importRange && importRange.start !== importRange.end) {
        const importsText = documentText.substring(importRange.start, importRange.end);
        try {
          let parserResult = parser.parse(importsText) as ParserResult;
          logDebug('Parser:', JSON.stringify(parserResult, null, 2));

          if (parserResult.invalidImports && parserResult.invalidImports.length > 0) {
            const errorMessages = parserResult.invalidImports.map((invalidImport) => {
              return formatImportError(invalidImport);
            });

            showMessage.error(`Invalid import syntax: ${errorMessages[0]}`);

            logError('Invalid imports found:', errorMessages.join('\n'));
            return;
          }

          if (configManager.getConfig().format.removeUnused) {
            const unusedImports = getUnusedImports(document.uri);
            logDebug('Unused imports found:', unusedImports);
            if (unusedImports.length > 0) {
              const updatedParserResult = removeUnusedImports(parserResult, unusedImports);
              parserResult = updatedParserResult;
            }
          }

          if (!needsFormatting(documentText, configManager.getConfig(), parserResult)) {
            logDebug('No formatting needed – skipping edit');
            showMessage.info('No formatting needed');
            return;
          }

          const formattedDocument = formatImports(documentText, configManager.getConfig(), parserResult);

          if (formattedDocument.error) {
            showMessage.error(formattedDocument.error);
            return;
          }

          const hasMultilineImports = parserResult.originalImports.some((imp) => imp.includes('\n'));

          if (formattedDocument.text !== documentText || hasMultilineImports) {
            const fullDocumentRange = new Range(document.positionAt(0), document.positionAt(documentText.length));

            await editor
              .edit((editBuilder) => {
                editBuilder.replace(fullDocumentRange, formattedDocument.text);
              })
              .then((success) => {
                if (success) {
                  logDebug('Successfully formatted imports in document');
                  showMessage.info('Imports formatted successfully!');
                } else {
                  showMessage.warning('Failed to format imports in document');
                }
              });
          } else {
            logDebug('No changes needed for the document');
          }
        } catch (error) {
          logError('Error:', error);
          const errorMessage = String(error);
          showMessage.error(`Error formatting imports: ${errorMessage}`);
        }
      }
    });

    const formatOnSaveDisposable = workspace.onDidSaveTextDocument((document) => {
      if (configManager.getConfig().format.onSave) {
        const editor = window.activeTextEditor;
        if (editor && editor.document === document) {
          commands.executeCommand('extension.format');
        }
      }
    });
    logDebug('🚀 ~ extension.ts:121 ~ activate ~ formatImportsCommand:', configManager.getConfig());

    context.subscriptions.push(formatImportsCommand);
    context.subscriptions.push(formatOnSaveDisposable);
  } catch (error) {
    logDebug('Error activating extension:', error);
    showMessage.error(`Extension activation error: ${error}`);
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
    }

    formattedError = `${errorMessage}\nIn: ${importStatement.trim()}`;
  }

  return formattedError;
}