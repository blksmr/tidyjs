import * as vscode from 'vscode';
import { ImportParser } from 'tidyimport-parser';

import { formatImports } from './formatter';
import { configManager } from './utils/config';
import { logDebug, logError } from './utils/log';

// Créer une instance du parser avec la configuration
const parser = new ImportParser({
  defaultGroupName: 'Misc',
  typeOrder: {
    sideEffect: 0,
    default: 1,
    named: 2,
    typeDefault: 3,
    typeNamed: 4
  },
  TypeOrder: {
    default: 0,
    named: 1,
    typeDefault: 2,
    typeNamed: 3,
    sideEffect: 4
  },
  patterns: {
    appSubfolderPattern: /@app\/([^/]+)/
  },
  importGroups: configManager.getImportGroups().map(group => ({
    name: group.name,
    regex: group.regex,
    order: group.order,
    isDefault: group.name === 'Misc'
  }))
});

export function activate(context: vscode.ExtensionContext) : void {
  configManager.loadConfiguration();
  
  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('importFormatter')) {
      configManager.loadConfiguration();
    }
  });

  const config = configManager.getFormatterConfig();

  const formatImportsCommand = vscode.commands.registerCommand(
    'extension.formatImports',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
      }

      const document = editor.document;
      const documentText = document.getText();

      // Si une sélection existe, formatter uniquement les imports dans cette sélection
      if (!editor.selection.isEmpty) {
        const selectedRange = editor.selection;
        const selectedText = document.getText(selectedRange);

        try {
          // Analyser le texte sélectionné avec le parser
          const parsedImports = parser.parse(selectedText);
          
          // Tenter de formater les imports uniquement dans cette sélection
          const formattedText = formatImports(parsedImports);

          if (formattedText !== selectedText) {
            editor.edit((editBuilder) => {
              editBuilder.replace(selectedRange, formattedText);
            }).then((success) => {
              if (success) {
                logDebug('Successfully formatted imports in selection');
                vscode.window.showInformationMessage('Imports formatted successfully!');
              } else {
                vscode.window.showErrorMessage('Failed to format imports in selection');
              }
            });
          } else {
            logDebug('No changes needed for the selection');
          }
        } catch (error) {
          logError('Error in selection:', error);
          const errorMessage = String(error);
          vscode.window.showErrorMessage(errorMessage);
        }
        return;
      }

      try {
        // Analyser le document avec le parser
        const parsedImports = parser.parse(documentText);
        
        // Formater tout le document en ne modifiant que les imports
        const formattedDocument = formatImports(parsedImports);

        // Vérifier si le texte a été modifié avant d'appliquer les changements
        if (formattedDocument !== documentText) {
          const fullDocumentRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(documentText.length)
          );

          // Remplacer tout le document par la version formatée
          await editor.edit((editBuilder) => {
            editBuilder.replace(fullDocumentRange, formattedDocument);
          }).then((success) => {
            if (success) {
              logDebug('Successfully formatted imports in document');
              vscode.window.showInformationMessage('Imports formatted successfully!');
            } else {
              vscode.window.showErrorMessage('Failed to format imports in document');
            }
          });
        } else {
          logDebug('No changes needed for the document');
        }
      } catch (error) {
        logError('Error:', error);
        const errorMessage = String(error);
        vscode.window.showErrorMessage(errorMessage);
      }
    }
  );

  // Ajouter un écouteur d'événement pour la sauvegarde
  const formatOnSave = vscode.workspace.onWillSaveTextDocument(async (event) => {
    // Vérifier si le formatage à la sauvegarde est activé dans la configuration
    if (!config.formatOnSave) {
      return; // Ne rien faire si l'option est désactivée
    }

    // Vérifier si le document est d'un type pris en charge
    const supportedLanguages = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'];
    if (!supportedLanguages.includes(event.document.languageId)) {
      return;
    }

    try {
      const documentText = event.document.getText();
      const parsedImports = parser.parse(documentText);
      const formattedDocument = formatImports(parsedImports);

      // Vérifier si le texte a été modifié
      if (formattedDocument !== documentText) {
        const fullDocumentRange = new vscode.Range(
          event.document.positionAt(0),
          event.document.positionAt(documentText.length)
        );

        // Ajouter l'édition à la liste des éditions à appliquer lors de la sauvegarde
        event.waitUntil(Promise.resolve([
          new vscode.TextEdit(fullDocumentRange, formattedDocument)
        ]));
      }
    } catch (error) {
      logError('Error formatting on save:', error);
      // Ne pas bloquer la sauvegarde en cas d'erreur
    }
  });

  context.subscriptions.push(formatImportsCommand);
  context.subscriptions.push(formatImportsCommand, formatOnSave);
}
