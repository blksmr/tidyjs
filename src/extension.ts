import { window, workspace, commands, Range } from 'vscode';
import type { ExtensionContext } from 'vscode';
import { formatImports } from './formatter';
import { ImportParser, ParserResult } from 'tidyimport-parser';
import { InvalidImport } from './types';
import { configManager } from './utils/config';
import { logDebug, logError } from './utils/log';
import { showMessage } from './utils/misc';

let parser = new ImportParser(configManager.getParserConfig());

export function activate(context: ExtensionContext): void {
  configManager.loadConfiguration();

  workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('tidyimport')) {
      configManager.loadConfiguration();
      parser = new ImportParser(configManager.getParserConfig());
    }
  });

  configManager.getFormatterConfig();

  const formatImportsCommand = commands.registerCommand(
    'extension.formatImports',
    async () => {
      const editor = window.activeTextEditor;
      if (!editor) {
        showMessage.warning('No active editor found');
        return;
      }

      const document = editor.document;
      const documentText = document.getText();

      try {
        const parserResult = parser.parse(documentText) as ParserResult;
        console.log(`[Parser] ${JSON.stringify(parserResult, null, 2)}`);
        logDebug('Parser result:', JSON.stringify(parserResult, null, 2));
        
        // Check for invalid imports and show errors
        if (parserResult.invalidImports && parserResult.invalidImports.length > 0) {
          const errorMessages = parserResult.invalidImports.map(invalidImport => {
            return formatImportError(invalidImport);
          });
          
          // Show error message with details about the first error
          showMessage.error(`Invalid import syntax: ${errorMessages[0]}`);
          
          // Log all errors for debugging
          logError('Invalid imports found:', errorMessages.join('\n'));
          return;
        }
        
        const formattedDocument = formatImports(
          documentText, 
          configManager.getFormatterConfig(), 
          parserResult
        );

        if (formattedDocument.error) {
          showMessage.error(formattedDocument.error);
          return;
        }

        if (formattedDocument.text !== documentText) {
          const fullDocumentRange = new Range(
            document.positionAt(0),
            document.positionAt(documentText.length)
          );

          await editor.edit((editBuilder) => {
            editBuilder.replace(fullDocumentRange, formattedDocument.text);
          }).then((success) => {
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
  );

  context.subscriptions.push(formatImportsCommand);
}

/**
 * Formats an import error into a more readable message
 * @param invalidImport L'import invalide avec les détails de l'erreur
 * @returns Un message d'erreur formaté pour l'affichage
 */
function formatImportError(invalidImport: InvalidImport): string {
  if (!invalidImport || !invalidImport.error) {
    return 'Erreur d\'import inconnue';
  }
  
  const errorMessage = invalidImport.error;
  const importStatement = invalidImport.raw || '';
  
  // Extrait le numéro de ligne et de colonne de l'erreur si disponible
  const lineMatch = errorMessage.match(/\((\d+):(\d+)\)/);
  let formattedError = errorMessage;
  
  if (lineMatch && lineMatch.length >= 3) {
    const line = parseInt(lineMatch[1], 10);
    const column = parseInt(lineMatch[2], 10);
    
    // Récupère la ligne problématique de la déclaration d'import
    const lines = importStatement.split('\n');
    
    if (line <= lines.length) {
      const problematicLine = lines[line - 1];
      
      // Ajoute un indicateur visuel pour montrer où se trouve l'erreur
      const indicator = ' '.repeat(Math.max(0, column - 1)) + '^';
      formattedError = `${errorMessage}\nDans: ${problematicLine.trim()}\n${indicator}`;
    }
  } else {
    // Si pas de numéro de ligne spécifique, affiche simplement la déclaration complète
    formattedError = `${errorMessage}\nDans: ${importStatement.trim()}`;
  }
  
  return formattedError;
}
