const { createMockConfig } = require('../constant');
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
      typeOrder: config.typeOrder,
      patterns: {
        subfolderPattern: config.patterns?.subfolderPattern
      }
    };
    console.log('🚀 ~ format-imports-parser.test.js:22 ~ createParserResult ~ parserConfig:', parserConfig);

    const parser = new ImportParser(parserConfig);
    return parser.parse(sourceText);
  }

  test('traite correctement les commentaires multilignes qui commencent et se terminent sur la même ligne', () => {
    const source = `// Misc
import { FormatterConfig } from './types';
/* Commentaire sur une ligne */ import { ParsedImport } from 'tidyjs-parser';
// Utils
import { logDebug } from './utils/log';`;

    const importRange = { start: 0, end: source.length };
    const parserResult = createParserResult(source);

    const result = formatImportsFromParser(source, importRange, parserResult, config);

    // Vérification du résultat
    expect(result).toBe(
      `// Misc
import { FormatterConfig } from './types';
import { ParsedImport }    from 'tidyjs-parser';

// Utils
import { logDebug } from './utils/log';

`)
  }
  );
});
