import * as vscode from 'vscode';
import { ImportParser, type ImportParserConfig } from 'tidyimport-parser';

import { formatImports } from './formatter';
import { configManager } from './utils/config';
import { logDebug, logError } from './utils/log';
import { isEmptyLine, isCommentLine } from './utils/misc';

// Fonction pour trouver la plage des imports dans un document
function findImportsRange(documentText: string, config: ImportParserConfig): { startLine: number; endLine: number; importsText: string } {
  const lines = documentText.split('\n');
  let startLine = 0;
  let endLine = 0;

  // Ignorer les lignes vides ou commentaires au début
  while (startLine < lines.length && (isEmptyLine(lines[startLine]) || isCommentLine(lines[startLine]))) {
    startLine++;
  }

  // Trouver la fin des imports
  endLine = startLine;
  while (endLine < lines.length) {
    const line = lines[endLine];
    // Vérifier si la ligne est un import, une ligne vide, un commentaire de section ou un fragment d'import
    // Créer une nouvelle instance de l'expression régulière à chaque itération pour éviter les problèmes avec le flag 'g'
    const importLineRegex = new RegExp(config.regexPatterns.importLine.source, 'i');
    const importFragmentRegex = new RegExp(config.regexPatterns.importFragment.source);
    const sectionCommentRegex = new RegExp(config.regexPatterns.sectionCommentPattern.source);
    
    if (importLineRegex.test(line) || 
        isEmptyLine(line) || 
        importFragmentRegex.test(line)) {
      endLine++;
    } else if (isCommentLine(line)) {
      // Si c'est un commentaire, vérifier si c'est un commentaire de section d'imports
      if (sectionCommentRegex.test(line)) {
        endLine++;
      } else {
        // Si ce n'est pas un commentaire de section d'imports, on s'arrête
        break;
      }
    } else {
      // Si on trouve une ligne qui n'est pas un import, une ligne vide ou un commentaire de section, on s'arrête
      break;
    }
  }

  // Extraire le texte des imports
  const importsText = lines.slice(startLine, endLine).join('\n');

  return { startLine, endLine, importsText };
}

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

      const { startLine, endLine, importsText } = findImportsRange(documentText, config);
      
      // Analyser les imports avec le parser
      const parsedImports = parser.parse(importsText);
      
      // Formater les imports
      const formattedImports = formatImports(parsedImports);
      
      // Appliquer les modifications
      if (formattedImports !== importsText) {
        const lines = documentText.split('\n');
        const beforeImports = lines.slice(0, startLine).join('\n');
        const afterImports = lines.slice(endLine).join('\n');
        
        const newDocumentText = 
          (beforeImports ? beforeImports + '\n' : '') + 
          formattedImports + 
          (afterImports ? '\n' + afterImports : '');
        
        // Créer une plage pour tout le document
        const fullDocumentRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(documentText.length)
        );
        
        // Appliquer les modifications
        editor.edit(editBuilder => {
          editBuilder.replace(fullDocumentRange, newDocumentText);
        });
        
        logDebug('Imports formatés avec succès');
      } else {
        logDebug('Aucune modification nécessaire');
      }
    }
  );
  context.subscriptions.push(formatImportsCommand);

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
      
      // Trouver la plage des imports dans le document
      const { startLine, endLine, importsText } = findImportsRange(documentText, config);
      
      // Si aucun import n'est trouvé, ne rien faire
      if (importsText.trim() === '') {
        return;
      }
      
      // Analyser les imports avec le parser
      const parsedImports = parser.parse(importsText);
      
      // Formater les imports
      const formattedImports = formatImports(parsedImports);
      
      // Vérifier si les imports ont été modifiés
      if (formattedImports !== importsText) {
        // Reconstruire le document avec les imports formatés
        const lines = documentText.split('\n');
        const beforeImports = lines.slice(0, startLine).join('\n');
        const afterImports = lines.slice(endLine).join('\n');
        
        const newDocumentText = 
          (beforeImports ? beforeImports + '\n' : '') + 
          formattedImports + 
          (afterImports ? '\n' + afterImports : '');
        
        // Créer une plage pour tout le document
        const fullDocumentRange = new vscode.Range(
          event.document.positionAt(0),
          event.document.positionAt(documentText.length)
        );
        
        // Ajouter l'édition à la liste des éditions à appliquer lors de la sauvegarde
        event.waitUntil(Promise.resolve([
          new vscode.TextEdit(fullDocumentRange, newDocumentText)
        ]));
      }
    } catch (error) {
      logError('Error formatting on save:', error);
      // Ne pas bloquer la sauvegarde en cas d'erreur
    }
  });
  context.subscriptions.push(formatImportsCommand, formatOnSave);
}
