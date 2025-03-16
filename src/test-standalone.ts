import { ImportParser } from 'tidyimport-parser';

// Types pour la nouvelle structure du parser
interface ImportSpecifier {
  type: 'named' | 'default' | 'typeNamed' | 'typeDefault' | 'sideEffect';
  source: string;
  specifiers: string[];
  raw: string;
  groupName: string;
  isPriority: boolean;
  appSubfolder: string | null;
}

interface ImportGroup {
  name: string;
  order: number;
  imports: ImportSpecifier[];
}

interface ParsedImports {
  groups: ImportGroup[];
  originalImports: string[];
  invalidImports: string[];
}

interface FormatterConfig {
  importGroups: { name: string; regex: RegExp; order: number }[];
  alignmentSpacing: number;
}

interface FormattedImportGroup {
  groupName: string;
  commentLine: string;
  importLines: string[];
}

// Fonctions utilitaires simplifiées
function isEmptyLine(line: string): boolean {
  return line.trim() === '';
}

function isCommentLine(line: string): boolean {
  return line.trim().startsWith('//');
}

function getFromIndex(line: string, isMultiline: boolean = false): number {
  if (isMultiline) {
    const lines = line.split('\n');
    const lastLine = lines[lines.length - 1];
    const fromIndex = lastLine.indexOf('from');
    return fromIndex > 0 ? fromIndex : -1;
  } else {
    const fromIndex = line.indexOf('from');
    return fromIndex > 0 ? fromIndex : -1;
  }
}

function alignFromKeyword(
  line: string,
  fromIndex: number,
  maxWidth: number,
  spacingWidth: number
): string {
  if (fromIndex <= 0) return line;

  const padding = ' '.repeat(maxWidth - fromIndex + spacingWidth);

  if (line.includes('\n')) {
    const lines = line.split('\n');
    const lastLineIndex = lines.length - 1;
    const lastLine = lines[lastLineIndex];

    lines[lastLineIndex] =
      lastLine.substring(0, fromIndex) +
      padding +
      'from' +
      lastLine.substring(fromIndex + 4);

    return lines.join('\n');
  } else {
    return (
      line.substring(0, fromIndex) +
      padding +
      'from' +
      line.substring(fromIndex + 4)
    );
  }
}

function formatSimpleImport(moduleName: string): string {
  return `import '${moduleName}';`;
}

function sortImportNamesByLength(names: string[]): string[] {
  return [...names].sort((a, b) => {
    // Extract actual name without 'type' keyword for comparison
    const aName = a.startsWith('type ') ? a.substring(5) : a;
    const bName = b.startsWith('type ') ? b.substring(5) : b;

    // First sort alphabetically
    const alphabeticalCompare = aName.localeCompare(bName);
    if (alphabeticalCompare !== 0) {
      return alphabeticalCompare;
    }

    // Then sort by length (longest first)
    return bName.length - aName.length;
  });
}

// Formateur simplifié
function formatImports(parsedImports: ParsedImports, config: FormatterConfig): string {
  // Cache pour la memoization des calculs de longueur
  const lengthMemoCache = new Map<string, number>();

  function cleanUpLines(lines: string[]): string[] {
    const cleanedLines: string[] = [];
    let previousLine = '';
    let consecutiveEmptyLines = 0;

    for (const currentLine of lines) {
      // Ne pas ajouter de commentaires identiques à la suite
      if (isCommentLine(currentLine) && previousLine === currentLine) {
        continue;
      }

      // Gérer les lignes vides
      if (isEmptyLine(currentLine)) {
        consecutiveEmptyLines++;
        if (consecutiveEmptyLines > 1) {
          continue;
        }
      } else {
        consecutiveEmptyLines = 0;
      }

      cleanedLines.push(currentLine);
      previousLine = currentLine;
    }

    // Supprimer la dernière ligne vide si elle existe
    if (cleanedLines.length > 0 && isEmptyLine(cleanedLines[cleanedLines.length - 1])) {
      cleanedLines.pop();
    }

    // Ajouter une ligne vide finale pour séparer les imports du reste du code
    cleanedLines.push('');

    return cleanedLines;
  }

  function alignImportsInGroup(
    importLines: string[],
    config: FormatterConfig
  ): string[] {
    // Optimisation: Calculer les indices "from" en une seule passe
    const fromIndices = new Map<string, number>();
    let maxWidth = 0;

    for (const line of importLines) {
      const isMultiline = line.includes('\n');
      const fromIndex = getFromIndex(line, isMultiline);

      if (fromIndex > 0) {
        fromIndices.set(line, fromIndex);
        maxWidth = Math.max(maxWidth, fromIndex);
      }
    }

    // Aligner tous les "from" du groupe en ajoutant l'espacement configuré
    return importLines.map((line) => {
      const fromIndex = fromIndices.get(line);
      if (fromIndex !== undefined) {
        return alignFromKeyword(line, fromIndex, maxWidth, config.alignmentSpacing);
      }
      return line;
    });
  }

  function alignImportsBySection(
    formattedGroups: FormattedImportGroup[],
    config: FormatterConfig
  ): string[] {
    const resultLines: string[] = [];
    const seenGroups = new Set<string>();

    for (const group of formattedGroups) {
      const { groupName, importLines } = group;

      // Si ce groupe a déjà été traité, ignorer son commentaire
      if (seenGroups.has(groupName)) {
        console.log(`Groupe dupliqué ignoré: ${groupName}`);
        continue;
      }

      seenGroups.add(groupName);

      // Ajouter le commentaire de groupe normalisé
      resultLines.push(`// ${groupName}`);

      // Aligner les imports au sein du groupe
      const alignedImports = alignImportsInGroup(importLines, config);

      // Ajouter les imports alignés
      resultLines.push(...alignedImports);

      // Ajouter une ligne vide après chaque groupe
      resultLines.push('');
    }

    // Nettoyage des lignes vides et commentaires dupliqués
    return cleanUpLines(resultLines);
  }

  function getMemoizedLength(importItem: ImportSpecifier): number {
    // Créer une clé unique basée sur les propriétés de l'import
    const cacheKey = `${importItem.source}_${importItem.type}_${importItem.specifiers.join(',')}`;

    if (lengthMemoCache.has(cacheKey)) {
      return lengthMemoCache.get(cacheKey)!;
    }

    const length = calculateEffectiveLengthForSorting(importItem);
    lengthMemoCache.set(cacheKey, length);
    return length;
  }

  function calculateEffectiveLengthForSorting(importItem: ImportSpecifier): number {
    const { type, specifiers } = importItem;

    // Import par défaut sans imports nommés
    if (type === 'default') {
      return specifiers[0].length;
    }

    // Imports nommés sans import par défaut
    if (type === 'named' && specifiers.length > 0) {
      // Optimisation: Éviter de mapper puis de prendre le max
      let maxLength = 0;
      for (const name of specifiers) {
        maxLength = Math.max(maxLength, name.length);
      }
      return maxLength;
    }

    // Import de type par défaut
    if (type === 'typeDefault') {
      return specifiers[0].length;
    }

    // Import de type nommé
    if (type === 'typeNamed' && specifiers.length > 0) {
      let maxLength = 0;
      for (const name of specifiers) {
        maxLength = Math.max(maxLength, name.length);
      }
      return maxLength;
    }

    // Cas par défaut (side-effect imports)
    return 0;
  }

  const getEffectiveLengthForSorting = getMemoizedLength;

  function formatDefaultImport(defaultName: string, moduleName: string, isTypeImport: boolean): string {
    return isTypeImport
      ? `import type ${defaultName} from '${moduleName}';`
      : `import ${defaultName} from '${moduleName}';`;
  }

  function formatNamedImports(
    namedImports: string[],
    moduleName: string,
    isTypeImport: boolean
  ): string {
    const typePrefix = isTypeImport ? 'type ' : '';

    // Formatter les imports en supprimant les commentaires
    const formattedItems = namedImports.map(item => {
      // Handle inline comments more robustly
      const commentIndex = item.indexOf('//');
      if (commentIndex !== -1) {
        return item.substring(0, commentIndex).trim();
      }
      return item;
    });

    // Filter out any empty items that might have resulted from comment processing
    const cleanedItems = formattedItems.filter(item => item.trim() !== '');

    if (cleanedItems.length === 1) {
      return `import ${typePrefix}{ ${cleanedItems[0]} } from '${moduleName}';`;
    } else {
      return `import ${typePrefix}{
    ${cleanedItems.join(',\n    ')}
} from '${moduleName}';`;
    }
  }

  function formatDefaultAndNamedImports(
    defaultName: string,
    namedImports: string[],
    moduleName: string,
    isTypeImport: boolean
  ): string {
    const typePrefix = isTypeImport ? 'type ' : '';

    // Format default import
    const defaultImport = `import ${typePrefix}${defaultName} from '${moduleName}';`;

    // Format named imports, supprimer les commentaires
    const formattedItems = namedImports.map(item => {
      // Check if the item has an inline comment and remove it
      const commentIndex = item.indexOf('//');
      if (commentIndex !== -1) {
        return item.substring(0, commentIndex).trim();
      }
      return item;
    });

    // Format named imports as a separate statement
    let namedImport;
    if (formattedItems.length === 1) {
      namedImport = `import ${typePrefix}{ ${formattedItems[0]} } from '${moduleName}';`;
    } else {
      namedImport = `import ${typePrefix}{
    ${formattedItems.join(',\n    ')}
} from '${moduleName}';`;
    }

    // Return both imports as separate statements
    return `${defaultImport}\n${namedImport}`;
  }

  function formatImportItem(
    importItem: ImportSpecifier,
    statements: string[]
  ): void {
    const {
      source: moduleName,
      specifiers,
      type
    } = importItem;

    // Si aucun nom d'import, c'est un import de module simple (side-effect import)
    if (type === 'sideEffect' || specifiers.length === 0) {
      statements.push(formatSimpleImport(moduleName));
      return;
    }

    const isTypeImport = type === 'typeDefault' || type === 'typeNamed';
    const isDefaultImport = type === 'default' || type === 'typeDefault';
    const hasNamedImports = type === 'named' || type === 'typeNamed' || (specifiers.length > 1 && isDefaultImport);

    // Filtrer et trier les imports nommés
    const namedImports = hasNamedImports
      ? (isDefaultImport ? specifiers.slice(1) : specifiers)
      : [];

    // Import par défaut uniquement (including type default imports)
    if (isDefaultImport && namedImports.length === 0) {
      statements.push(formatDefaultImport(specifiers[0], moduleName, isTypeImport));
      return;
    }

    // Tri par longueur des noms d'import (du plus court au plus long)
    const sortedNamedImports = sortImportNamesByLength(namedImports);

    // Import par défaut ET imports nommés
    if (isDefaultImport && namedImports.length > 0) {
      statements.push(formatDefaultAndNamedImports(
        specifiers[0],
        sortedNamedImports,
        moduleName,
        isTypeImport
      ));
    }
    // Uniquement des imports nommés
    else if (namedImports.length > 0) {
      statements.push(formatNamedImports(sortedNamedImports, moduleName, isTypeImport));
    }
  }

  function sortImportsInGroup(imports: ImportSpecifier[]): ImportSpecifier[] {
    return imports.sort((a, b) => {
      // First sort side-effect imports to the top
      const aIsSideEffect = a.type === 'sideEffect' || a.specifiers.length === 0;
      const bIsSideEffect = b.type === 'sideEffect' || b.specifiers.length === 0;

      if (aIsSideEffect && !bIsSideEffect) return -1;
      if (!aIsSideEffect && bIsSideEffect) return 1;

      // Order: default > named > type default > type named
      const aIsReact = a.source === 'react';
      const bIsReact = b.source === 'react';

      // Handle React imports first
      if (aIsReact && !bIsReact) return -1;
      if (!aIsReact && bIsReact) return 1;

      if (aIsReact && bIsReact) {
        // 1. Default imports (non-type)
        if (a.type === 'default' && b.type !== 'default') return -1;
        if (b.type === 'default' && a.type !== 'default') return 1;

        // 2. Named imports (non-type)
        if (a.type === 'named' && b.type !== 'named') return -1;
        if (b.type === 'named' && a.type !== 'named') return 1;

        // 3. Type default imports
        if (a.type === 'typeDefault' && b.type !== 'typeDefault') return -1;
        if (b.type === 'typeDefault' && a.type !== 'typeDefault') return 1;

        // 4. Type named imports
        if (a.type === 'typeNamed' && b.type !== 'typeNamed') return -1;
        if (b.type === 'typeNamed' && a.type !== 'typeNamed') return 1;
      }

      // For non-React modules, sort by module name
      if (a.source !== b.source) {
        return a.source.localeCompare(b.source);
      }

      // Within the same module type, sort by type (non-type first)
      const aIsType = a.type === 'typeDefault' || a.type === 'typeNamed';
      const bIsType = b.type === 'typeDefault' || b.type === 'typeNamed';
      if (aIsType !== bIsType) {
        return aIsType ? 1 : -1;
      }

      // Sort by effective length for imports of the same type
      const aLength = getEffectiveLengthForSorting(a);
      const bLength = getEffectiveLengthForSorting(b);
      return bLength - aLength;
    });
  }

  function generateFormattedImports(
    parsedImports: ParsedImports,
    config: FormatterConfig
  ): string {
    // Ordre défini des groupes d'imports
    const configGroups = [...config.importGroups]
      .sort((a, b) => a.order - b.order)
      .map((group) => group.name);

    const preferredOrderMap: Map<string, number> = new Map();
    configGroups.forEach((name, index) => {
      preferredOrderMap.set(name, index);
    });

    // Trier les groupes selon l'ordre défini
    const sortedGroups = [...parsedImports.groups].sort((a, b) => {
      const indexA = preferredOrderMap.has(a.name)
        ? preferredOrderMap.get(a.name)!
        : Infinity;
      const indexB = preferredOrderMap.has(b.name)
        ? preferredOrderMap.get(b.name)!
        : Infinity;

      // Si les deux groupes sont dans l'ordre préféré
      if (indexA !== Infinity && indexB !== Infinity) {
        return indexA - indexB;
      }

      // Si seulement un groupe est dans l'ordre préféré
      if (indexA !== Infinity) {
        return -1;
      }
      if (indexB !== Infinity) {
        return 1;
      }

      // Fallback sur l'ordre des groupes dans la configuration
      return a.order - b.order;
    });

    const formattedGroups: FormattedImportGroup[] = [];

    for (const group of sortedGroups) {
      if (group.imports.length === 0) {
        continue;
      }

      const groupResult: FormattedImportGroup = {
        groupName: group.name,
        commentLine: `// ${group.name}`,
        importLines: [],
      };

      const sortedImports = sortImportsInGroup(group.imports);

      for (const importItem of sortedImports) {
        const formattedLines: string[] = [];
        formatImportItem(importItem, formattedLines);
        groupResult.importLines.push(...formattedLines);
      }

      formattedGroups.push(groupResult);
    }

    // Utiliser la fonction d'alignement par section avec la configuration
    const alignedLines = alignImportsBySection(formattedGroups, config);

    return alignedLines.join('\n');
  }

  // Générer le texte formaté
  return generateFormattedImports(parsedImports, config);
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

// Configuration du formateur
const formatterConfig: FormatterConfig = {
  importGroups: [
    { name: 'Misc', regex: /^(react|lodash|date-fns)$/, order: 0 },
    { name: 'DS', regex: /^ds$/, order: 1 },
    { name: '@app', regex: /^@app/, order: 2 }
  ],
  alignmentSpacing: 1
};

// Exemple d'imports à formater
const code = `
import { a, b } from "module";
import React from 'react';
import { useState, useEffect } from 'react';
import { Button } from 'ds';
import { UserService } from '@app/services';
`;

// Analyser le code avec le parser
const parsedImports = parser.parse(code);

// Afficher la structure analysée
console.log('Parsed imports:');
console.log(JSON.stringify(parsedImports, null, 2));

// Formater les imports
const formattedCode = formatImports(parsedImports, formatterConfig);

// Afficher le résultat formaté
console.log('\nFormatted code:');
console.log(formattedCode);
