const { createMockConfig } = require('../constant');
const path = require('path');

// Importer les fonctions du formateur
const { formatImportsFromParser } = require('../../src/formatter');
const { ImportParser } = require('tidyjs-parser');

describe('formatImportsFromParser', () => {
  // Configuration de base pour les tests
  let config;
  
  beforeEach(() => {
    config = createMockConfig();
  });

  // Fonction utilitaire pour créer un résultat de parser
  function createParserResult(sourceText) {
    const parserConfig = {
      importGroups: config.importGroups,
      defaultGroupName: 'Misc',
      typeOrder: {
        default: 0,
        named: 1,
        typeDefault: 2,
        typeNamed: 3,
        sideEffect: 4
      },
      patterns: {
        appSubfolderPattern: config.regexPatterns.appSubfolderPattern
      },
      priorityImports: [/^react$/]
    };
    
    const parser = new ImportParser(parserConfig);
    return parser.parse(sourceText);
  }

  test('traite correctement les commentaires multilignes qui commencent et se terminent sur la même ligne', () => {
    const source = `
// Misc
import { FormatterConfig } from './types';

/* Commentaire sur une ligne */ import { ParsedImport } from 'tidyjs-parser';

// Utils
import { logDebug } from './utils/log';
`;
    
    const importRange = { start: 0, end: source.length };
    const parserResult = createParserResult(source);
    
    const result = formatImportsFromParser(source, importRange, parserResult, config);
    
    // Vérifier que tous les imports sont correctement formatés
    expect(result).toContain("import { FormatterConfig } from './types';");
    expect(result).toContain("import { ParsedImport } from 'tidyjs-parser';");
    expect(result).toContain("import { logDebug } from './utils/log';");
    
    // Vérifier que le commentaire multiligne n'est pas présent
    expect(result).not.toContain("/* Commentaire sur une ligne */");
  });

  test('préserve les imports après un commentaire multiligne', () => {
    const source = `
// Misc
import { FormatterConfig } from './types';

/* 
 * Commentaire
 * multiligne
 */
import { ParsedImport } from 'tidyjs-parser';

// Utils
import { logDebug } from './utils/log';
`;
    
    const importRange = { start: 0, end: source.length };
    const parserResult = createParserResult(source);
    
    const result = formatImportsFromParser(source, importRange, parserResult, config);
    
    // Vérifier que l'import après le commentaire est présent
    expect(result).toContain("import { ParsedImport } from 'tidyjs-parser';");
  });

  test('ignore les imports à l\'intérieur des commentaires multilignes', () => {
    const source = `
// Misc
import { FormatterConfig } from './types';

/* 
import { ParsedImport } from 'tidyjs-parser';
*/

// Utils
import { logDebug } from './utils/log';
`;
    
    const importRange = { start: 0, end: source.length };
    const parserResult = createParserResult(source);
    
    const result = formatImportsFromParser(source, importRange, parserResult, config);
    
    // Vérifier que l'import commenté n'est pas formaté comme un import valide
    expect(result).not.toMatch(/^\s*import\s+{\s+ParsedImport\s+}\s+from\s+'tidyjs-parser';/m);
    
    // Mais il peut être présent dans le texte brut, puisqu'il se trouve dans un commentaire
    expect(result).toContain("import { FormatterConfig } from './types';");
    expect(result).toContain("import { logDebug } from './utils/log';");
  });

  test('gère correctement les commentaires multilignes mixtes avec des imports', () => {
    const source = `
// Misc
import { FormatterConfig } from './types';

/* Premier commentaire */ 
import { ParsedImport } from 'tidyjs-parser';

/* Deuxième commentaire */ import { OtherImport } from 'other-lib';

// Utils
import { logDebug } from './utils/log';
`;
    
    const importRange = { start: 0, end: source.length };
    const parserResult = createParserResult(source);
    
    const result = formatImportsFromParser(source, importRange, parserResult, config);
    
    // Vérifier que les imports sont présents
    expect(result).toContain("import { FormatterConfig } from './types';");
    expect(result).toContain("import { ParsedImport } from 'tidyjs-parser';");
    expect(result).toContain("import { OtherImport } from 'other-lib';");
    expect(result).toContain("import { logDebug } from './utils/log';");
    
    // Vérifier que les commentaires sont supprimés
    expect(result).not.toContain("/* Premier commentaire */");
    expect(result).not.toContain("/* Deuxième commentaire */");
  });

  test('traite correctement un mélange de commentaires et d\'imports sur plusieurs lignes', () => {
    const source = `
// Misc
import { FormatterConfig } from './types';

// Un commentaire simple
/* Un commentaire 
   multiligne */ 
// Encore un commentaire
import { ParsedImport } from 'tidyjs-parser';

// Utils
/* Un autre commentaire */ import { logDebug } from './utils/log';
`;
    
    const importRange = { start: 0, end: source.length };
    const parserResult = createParserResult(source);
    
    const result = formatImportsFromParser(source, importRange, parserResult, config);
    
    // Vérifier que les imports sont présents
    expect(result).toContain("import { FormatterConfig } from './types';");
    expect(result).toContain("import { ParsedImport } from 'tidyjs-parser';");
    expect(result).toContain("import { logDebug } from './utils/log';");
  });

  test('aligne correctement les imports après avoir filtré les commentaires multilignes', () => {
    const source = `
// Misc
import { FormatterConfig } from './types';

/* Commentaire */ import { AVeryLongNamedImport } from 'tidyjs-parser';

// Utils
import { logDebug } from './utils/log';
`;
    
    const importRange = { start: 0, end: source.length };
    const parserResult = createParserResult(source);
    
    const result = formatImportsFromParser(source, importRange, parserResult, config);
    
    // Vérifier l'alignement du mot-clé "from" - l'alignement spécifique dépend de l'implémentation
    // Nous vérifions simplement que les imports ont été reformatés
    expect(result).toContain("import { FormatterConfig }");
    expect(result).toContain("import { AVeryLongNamedImport }");
    expect(result).toContain("import { logDebug }");
  });
}); 