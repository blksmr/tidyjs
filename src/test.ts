import { ImportParser } from 'tidyimport-parser';
import { formatImports } from './formatter';

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
const formattedCode = formatImports(parsedImports);

// Afficher le résultat formaté
console.log('\nFormatted code:');
console.log(formattedCode);
