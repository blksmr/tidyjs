import * as vscode from 'vscode';
import { formatImports } from './formatter';
import { ImportParser } from 'tidyimport-parser';

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
  importGroups: [
    {
      name: 'Misc',
      regex: /^(react|lodash|date-fns)$/,
      order: 0,
      isDefault: true
    },
    {
      name: 'DS',
      regex: /^ds$/,
      order: 1
    },
    {
      name: '@app',
      regex: /^@app/,
      order: 2
    }
  ]
});
import { configManager } from './utils/config';
import { logDebug, logError } from './utils/log';

export function activate(context: vscode.ExtensionContext): void {
  configManager.loadConfiguration();

  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('tidyimport')) {
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


      if (!editor.selection.isEmpty) {
        const selectedRange = editor.selection;
        const selectedText = document.getText(selectedRange);

        try {

          const formattedText = formatImports(selectedText);

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

        const formattedDocument = formatImports(documentText);


        if (formattedDocument !== documentText) {
          const fullDocumentRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(documentText.length)
          );


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

  // const formatOnSave = vscode.workspace.onWillSaveTextDocument((event) => {
  //   if (!config.formatOnSave) {
  //     return;
  //   }

  //   const supportedLanguages = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'];
  //   if (!supportedLanguages.includes(event.document.languageId)) {
  //     return;
  //   }

  //   const documentText = event.document.getText();
    
  //   try {
  //     const formattedDocument = formatImports(documentText);
      
  //     if (formattedDocument !== documentText) {
  //       const fullDocumentRange = new vscode.Range(
  //         event.document.positionAt(0),
  //         event.document.positionAt(documentText.length)
  //       );
        
  //       event.waitUntil(
  //         Promise.resolve([
  //           new vscode.TextEdit(fullDocumentRange, formattedDocument)
  //         ])
  //       );
  //     }
  //   } catch (error) {
  //     logError('Error formatting on save:', error);
  //   }
  // });

  context.subscriptions.push(formatImportsCommand);
  // context.subscriptions.push(formatImportsCommand, formatOnSave);
}
