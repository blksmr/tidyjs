const fs = require('fs');
const path = require('path');

// Fonction pour vérifier si une ligne est vide
function isEmptyLine(line) {
  return line.trim() === '';
}

// Fonction pour vérifier si une ligne est un commentaire
function isCommentLine(line) {
  return line.trim().startsWith('//');
}

// Fonction pour trouver la plage des imports dans un document
function findImportsRange(documentText, config) {
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
    const importLineRegex = new RegExp(/^\s*import\s+.*?(?:from\s+['"][^'"]+['"])?\s*;?.*$/i);
    const importFragmentRegex = new RegExp(/^\s*([a-zA-Z0-9_]+,|[{}],?|\s*[a-zA-Z0-9_]+,?|\s*[a-zA-Z0-9_]+\s+from|\s*from|^[,}]\s*)$/);
    const sectionCommentRegex = new RegExp(/^\s*\/\/\s*(?:Misc|DS|@app(?:\/[a-zA-Z0-9_-]+)?|@core|@library|Utils)/);
    
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

// Lire le fichier de test
const testFilePath = path.join(__dirname, 'imports', 'test-formatter.ts');
const fileContent = fs.readFileSync(testFilePath, 'utf8');

// Trouver la plage des imports dans le fichier
const { startLine, endLine, importsText } = findImportsRange(fileContent, {});

console.log('Plage des imports :');
console.log(`Ligne de début : ${startLine}`);
console.log(`Ligne de fin : ${endLine}`);
console.log('\nTexte des imports :');
console.log(importsText);

// Simuler le formatage des imports
// Dans une vraie implémentation, nous utiliserions le parser et le formatter
const formattedImports = `// Misc
import React                from 'react';
import { useState, useEffect } from 'react';
import { a, b }            from 'module';

// DS
import { Button }          from 'ds';

// @app
import { UserService }     from '@app/services';
`;

// Reconstruire le document avec les imports formatés et le reste du contenu préservé
const lines = fileContent.split('\n');
const beforeImports = lines.slice(0, startLine).join('\n');
const afterImports = lines.slice(endLine).join('\n');

const newDocumentText = 
  (beforeImports ? beforeImports + '\n' : '') + 
  formattedImports + 
  (afterImports ? '\n' + afterImports : '');

console.log('\nDocument avec imports formatés :');
console.log(newDocumentText);

// Écrire le résultat dans un nouveau fichier
const outputFilePath = path.join(__dirname, 'imports', 'test-formatter-formatted.ts');
fs.writeFileSync(outputFilePath, newDocumentText, 'utf8');

console.log(`\nRésultat écrit dans ${outputFilePath}`);
