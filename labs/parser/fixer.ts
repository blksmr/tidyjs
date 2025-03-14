import { parse } from '@babel/parser';
import generate from '@babel/generator';

/**
 * Résultat de la correction d'un import
 */
export interface FixResult {
  fixed: string | null;
  isValid: boolean;
  errors: string[];
}

/**
 * Corrige automatiquement les spécificateurs en double dans une déclaration d'import
 * @param importStmt La déclaration d'import à corriger
 * @returns La déclaration d'import corrigée, ou null si la correction n'est pas possible
 */
function fixDuplicateSpecifiers(importStmt: string): string | null {
  // Si ce n'est pas un import nommé avec accolades, pas de risque de duplication
  if (!importStmt.includes('{')) {
    return importStmt;
  }

  try {
    // Regex pour extraire les différentes parties de l'import
    const importParts = importStmt.match(/^(import\s+(?:type\s+)?)({[^}]*})(\s+from\s+['"][^'"]+['"];?)$/);
    if (!importParts) {
      return importStmt;
    }

    const [_, prefix, specifiersBlock, suffix] = importParts;
    const specifiersContent = specifiersBlock.substring(1, specifiersBlock.length - 1);

    // Séparer les spécificateurs et les nettoyer
    const rawSpecifiers = specifiersContent.split(',').map(s => s.trim()).filter(Boolean);

    // Utiliser un Map pour conserver les spécificateurs uniques avec leur forme complète
    const uniqueSpecifiers = new Map<string, string>();

    for (const spec of rawSpecifiers) {
      // Vérifier s'il s'agit d'un spécificateur de type
      const isType = spec.startsWith('type ');
      const specWithoutType = isType ? spec.substring(5).trim() : spec;

      // Vérifier s'il s'agit d'un spécificateur avec alias
      let key: string;
      let fullSpec = spec;

      if (specWithoutType.includes(' as ')) {
        const [name, _] = specWithoutType.split(' as ');
        key = (isType ? 'type ' : '') + name.trim();
      } else {
        key = spec;
      }

      // Conserver seulement la première occurrence
      if (!uniqueSpecifiers.has(key)) {
        uniqueSpecifiers.set(key, fullSpec);
      }
    }

    // Reconstruire le bloc de spécificateurs sans doublons
    const correctedSpecifiers = Array.from(uniqueSpecifiers.values()).join(', ');
    const correctedImport = `${prefix}{${correctedSpecifiers}}${suffix}`;

    return correctedImport;
  } catch (error) {
    // En cas d'erreur, retourner l'import original
    return importStmt;
  }
}
/**
 * Tente de corriger une déclaration d'import en utilisant le parser Babel
 * Amélioré pour fournir des messages d'erreur plus détaillés
 * @param importStmt La déclaration d'import à corriger
 * @returns Le résultat de la correction
 */
/**
 * Support amélioré pour la syntaxe "import Default as Alias" sans accolades
 * Cette fonction vérifie si un import pourrait être de la forme "import Default as Alias from 'module'"
 * et le transforme en une forme valide pour Babel
 */
function normalizeDefaultImportAlias(importStmt: string): string {
  // Détection de la syntaxe "import X as Y from 'module'"
  const defaultAliasMatch = importStmt.match(/import\s+(\w+)\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/);

  if (defaultAliasMatch) {
    // Il s'agit d'un import par défaut avec alias, nous devons le transformer
    // en une syntaxe correcte pour TypeScript: "import * as Y from 'module'"
    const [_, defaultName, aliasName, moduleName] = defaultAliasMatch;
    return `import * as ${aliasName} from '${moduleName}';`;
  }

  return importStmt;
}

/**
 * Version améliorée de fixImportStatement qui gère correctement les alias par défaut
 */
export function fixImportStatement(importStmt: string): FixResult {
  try {
    // Vérifier si l'import est vide ou ne contient que des espaces
    if (!importStmt.trim()) {
      return {
        fixed: null,
        isValid: false,
        errors: ['La déclaration d\'import est vide']
      };
    }

    // Nettoyer l'import des commentaires à la fin
    let cleanedImport = removeTrailingComments(importStmt);

    // Vérification préliminaire pour le cas "import X as Y from 'module'"
    const hasDefaultAlias = cleanedImport.match(/import\s+\w+\s+as\s+\w+\s+from/);

    if (hasDefaultAlias) {
      // Normaliser la syntaxe pour les importations par défaut avec alias
      cleanedImport = normalizeDefaultImportAlias(cleanedImport);
    }

    // Vérification préliminaire pour les imports avec duplications
    const hasDuplicates = detectDuplicateSpecifiers(cleanedImport);

    if (hasDuplicates) {
      // Au lieu de retourner une erreur, tenter de corriger automatiquement
      const fixedImport = fixDuplicateSpecifiers(cleanedImport);
      if (fixedImport) {
        cleanedImport = fixedImport;
        // Continuer le traitement avec l'import corrigé
      }
    }

    // Parser le code avec Babel
    const ast = parse(cleanedImport, {
      sourceType: 'module',
      plugins: ['typescript'],
      errorRecovery: true
    });

    // Vérifier s'il y a des erreurs de parsing
    const errors: string[] = [];
    let hasErrors = false;

    if (ast.errors && ast.errors.length > 0) {
      hasErrors = true;
      ast.errors.forEach(error => {
        let errorMessage = error.toString();

        // Ajouter des explications pour les erreurs courantes
        if (errorMessage.includes("Unexpected token, expected \"from\"")) {
          if (cleanedImport.includes(" as ")) {
            errorMessage += "\nSuggestion: Si vous utilisez 'as' pour un alias, assurez-vous de la syntaxe correcte:"
              + "\n- Pour les imports nommés: import { Original as Alias } from 'module';"
              + "\n- Pour les imports d'espace de noms (namespace): import * as Alias from 'module';"
              + "\n- La syntaxe 'import Default as Alias from module' n'est pas standard en TypeScript/ES6.";
          }
        } else if (errorMessage.includes("Unexpected token")) {
          errorMessage += "\nVérifiez la syntaxe: Les accolades, virgules et point-virgules sont-ils correctement placés?";
        } else if (errorMessage.includes("has already been declared")) {
          errorMessage += "\nVous avez déclaré le même identificateur plusieurs fois dans le même import. " +
            "Assurez-vous de ne pas avoir de doublons dans votre liste d'imports.";
        }

        errors.push(errorMessage);
      });

      // Si les erreurs sont trop graves, abandonner la correction
      if (errors.some(err =>
        err.includes('Unexpected token') ||
        err.includes('Unexpected identifier') ||
        err.includes('has already been declared')
      )) {
        return {
          fixed: null,
          isValid: false,
          errors
        };
      }
    }

    // Générer le code corrigé
    const output = generate(ast, {
      retainLines: false,
      concise: false,
      jsescOption: {
        quotes: 'single'
      }
    });

    // Standardiser la sortie
    let fixed = output.code.trim();

    // Restaurer l'intention originale pour les imports par défaut avec alias
    if (hasDefaultAlias && fixed.includes('* as')) {
      // Récupérer les détails de l'import original pour restaurer le nom par défaut
      const originalMatch = importStmt.match(/import\s+(\w+)\s+as\s+(\w+)\s+from/);
      if (originalMatch) {
        const [_, defaultName, aliasName] = originalMatch;
        const fixedMatch = fixed.match(/import\s+\*\s+as\s+(\w+)\s+from/);

        if (fixedMatch) {
          // Ajouter une note explicative à l'erreur
          errors.push(
            `Note: La syntaxe 'import ${defaultName} as ${aliasName}' n'est pas standard en ES6/TypeScript. ` +
            `Elle a été transformée en 'import * as ${aliasName}', mais gardez à l'esprit que ces deux formes ` +
            `ont des comportements différents. La forme recommandée pour un import par défaut avec alias serait: ` +
            `import { default as ${aliasName} } from '...' ou simplement import ${aliasName} from '...'`
          );
        }
      }
    }

    // Garantir qu'il y a un point-virgule à la fin
    if (!fixed.endsWith(';')) {
      fixed += ';';
    }

    // Vérifier la validité minimale pour un import
    const isImportStatement = fixed.startsWith('import');
    const hasSource = fixed.includes('from') || fixed.match(/import\s+['"]/);

    const isValid = Boolean(isImportStatement && hasSource && !hasErrors);

    return {
      fixed: isValid ? fixed : null,
      isValid,
      errors
    };
  } catch (error) {
    // Améliorer le message d'erreur pour les cas courants
    let errorMessage = error instanceof Error ? error.message : String(error);

    // Ajouter des explications pour les erreurs courantes de syntaxe
    if (errorMessage.includes("Cannot read") || errorMessage.includes("undefined")) {
      errorMessage += ". Cela peut être dû à une syntaxe d'import incorrecte. Vérifiez la structure de votre déclaration d'import.";
    }

    return {
      fixed: null,
      isValid: false,
      errors: [errorMessage]
    };
  }
}

/**
 * Détecte les specifiers en double dans une déclaration d'import
 * Retourne un tableau avec les noms des spécificateurs dupliqués, ou null si aucun doublon n'est trouvé
 */
function detectDuplicateSpecifiers(importStmt: string): string[] | null {
  // Si ce n'est pas un import nommé avec accolades, pas de risque de duplication
  if (!importStmt.includes('{')) {
    return null;
  }

  // Extraire le contenu entre accolades
  const match = importStmt.match(/{([^}]*)}/);
  if (!match) {
    return null;
  }

  // Récupérer les spécificateurs
  const specifiersContent = match[1];
  const specifiers = specifiersContent
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      // Enlever les annotations de type et les alias pour l'analyse de duplication
      const withoutType = s.replace(/^type\s+/, '');
      return withoutType.split(' as ')[0].trim();
    });

  // Vérifier les doublons
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const spec of specifiers) {
    if (seen.has(spec)) {
      duplicates.add(spec);
    } else {
      seen.add(spec);
    }
  }

  return duplicates.size > 0 ? Array.from(duplicates) : null;
}

/**
 * Supprime les commentaires à la fin de la déclaration d'import
 * Version améliorée qui gère mieux les imports multi-lignes
 */
function removeTrailingComments(importStmt: string): string {
  // Séparer la ligne en segments
  const lines = importStmt.split('\n');

  // Garder seulement les lignes pertinentes
  const cleanedLines: string[] = [];

  for (const line of lines) {
    // Ignorer les lignes de commentaires pures
    if (line.trim().startsWith('//')) {
      continue;
    }

    // Pour les autres lignes, enlever les commentaires à la fin
    let cleanedLine = line.replace(/\/\/.*$/, '').trim();

    if (cleanedLine) {
      cleanedLines.push(cleanedLine);
    }
  }

  // Si après nettoyage nous n'avons plus de lignes, retourner une chaîne vide
  if (cleanedLines.length === 0) {
    return '';
  }

  // Reconstruire la déclaration en préservant la structure multi-ligne si nécessaire
  let cleaned = cleanedLines.join('\n');

  // Garantir que la déclaration se termine par un point-virgule
  if (!cleaned.endsWith(';')) {
    cleaned += ';';
  }

  return cleaned;
}

/**
 * Fonction utilitaire pour valider et corriger un import avec Babel
 */
export function validateAndFixImportWithBabel(importStmt: string): {
  fixed: string | null;
  isValid: boolean;
  error?: string;
} {
  const result = fixImportStatement(importStmt);

  return {
    fixed: result.fixed,
    isValid: result.isValid,
    error: result.errors.length > 0 ? result.errors.join('; ') : undefined
  };
}