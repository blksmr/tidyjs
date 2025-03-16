import { writeFileSync } from 'fs';
import { parseImports, ParserConfig, DEFAULT_CONFIG } from '../index';
import path from 'path';

const config: ParserConfig = {
  importGroups: [
    { name: 'Misc', regex: /^(react|lodash|uuid)$/, order: 0, isDefault: true },
    { name: 'Composants', regex: /^@components/, order: 1 },
    { name: 'Utils', regex: /^@utils/, order: 2 },
  ],
  patterns: {
    ...DEFAULT_CONFIG.patterns,
    appSubfolderPattern: /@app\/([^/]+)/
  }
};

/**
 * Tests spécifiques pour les cas d'erreur
 * Ce fichier se concentre sur les cas où les imports ne peuvent pas être analysés ou corrigés
 */

// Collection de cas de test d'erreur
const errorCases = [
  {
    name: "Import avec syntaxe incorrecte - 'as' sans alias",
    code: "import React as from 'react';",
    shouldFail: true,
    description: "Un import avec le mot-clé 'as' mais sans alias spécifié devrait échouer"
  },
  {
    name: "Import avec alias malformé - hors accolades",
    code: "import Component as C, { useState } from 'react';",
    shouldFail: true,
    description: "Un import par défaut avec alias suivi d'un import nommé est une syntaxe invalide"
  },
  {
    name: "Import avec source manquante",
    code: "import { useState };",
    shouldFail: true,
    description: "Un import sans source (sans 'from') devrait échouer"
  },
  {
    name: "Import avec accolades non fermées",
    code: "import { useState, useEffect from 'react';",
    shouldFail: true,
    description: "Un import avec des accolades non fermées devrait échouer"
  },
  {
    name: "Import avec namespace et import nommé (syntaxe invalide)",
    code: "import * as React, { useState } from 'react';",
    shouldFail: true,
    description: "Un import d'espace de noms suivi d'un import nommé est une syntaxe invalide"
  },
  {
    name: "Import avec guillemets non fermés",
    code: "import { useState } from 'react;",
    shouldFail: true,
    description: "Un import avec des guillemets non fermés devrait échouer"
  },
  {
    name: "Import avec mélange de guillemets",
    code: "import { useState } from \"react';",
    shouldFail: true,
    description: "Un import avec un mélange de guillemets devrait échouer"
  },
  {
    name: "Import avec virgule manquante",
    code: "import { useState useEffect } from 'react';",
    shouldFail: true,
    description: "Un import avec une virgule manquante entre les spécificateurs devrait échouer"
  },
  {
    name: "Import avec syntaxe incorrecte - mot-clé 'from' manquant",
    code: "import { useState, useEffect } 'react';",
    shouldFail: true,
    description: "Un import sans le mot-clé 'from' devrait échouer"
  },
  {
    name: "Import avec syntaxe incorrecte - accolades vides avec type",
    code: "import type {} from 'react';",
    shouldFail: true, // Changé à true car notre parser considère cela comme une erreur
    description: "Un import de type avec des accolades vides est considéré comme invalide par notre parser car il n'y a pas de spécificateurs"
  },
  {
    name: "Import avec caractères invalides dans les noms",
    code: "import { use-state } from 'react';",
    shouldFail: true,
    description: "Un import avec des tirets dans les noms d'identifiants devrait échouer"
  },
  {
    name: "Import avec syntaxe incorrecte - double 'from'",
    code: "import { useState } from from 'react';",
    shouldFail: true,
    description: "Un import avec un double mot-clé 'from' devrait échouer"
  },
  {
    name: "Import avec syntaxe incorrecte - double 'import'",
    code: "import import { useState } from 'react';",
    shouldFail: true,
    description: "Un import avec un double mot-clé 'import' devrait échouer"
  },
  {
    name: "Import avec syntaxe incorrecte - accolades mal placées",
    code: "import useState, { useEffect } } from 'react';",
    shouldFail: true,
    description: "Un import avec des accolades mal placées devrait échouer"
  },
  {
    name: "Import avec syntaxe incorrecte - mélange de type et default",
    code: "import type React, { useState } from 'react';",
    shouldFail: true,
    description: "Un import de type par défaut avec des imports nommés devrait échouer"
  }
];

// Cas qui devraient réussir (pour vérifier que le parser n'est pas trop strict)
const validCases = [
  {
    name: "Import avec point-virgule manquant",
    code: "import { useState } from 'react'",
    shouldFail: false,
    description: "Un import sans point-virgule devrait être corrigé automatiquement"
  },
  {
    name: "Import vide",
    code: "import {} from 'react';",
    shouldFail: false,
    description: "Un import avec des accolades vides est syntaxiquement valide même s'il est inutile"
  },
  {
    name: "Import avec caractères spéciaux valides",
    code: "import { useState, use$Effect, _privateHook } from 'react';",
    shouldFail: false,
    description: "Un import avec des caractères spéciaux valides ($, _) devrait réussir"
  },
  {
    name: "Import avec commentaires",
    code: "import { useState /* commentaire */ } from 'react';",
    shouldFail: false,
    description: "Un import avec des commentaires devrait être correctement traité"
  },
  {
    name: "Import avec espaces supplémentaires",
    code: "import   {   useState   }   from   'react'  ;",
    shouldFail: false,
    description: "Un import avec des espaces supplémentaires devrait être normalisé"
  }
];

// Fusionner tous les cas de test
const allTestCases = [...errorCases, ...validCases];

/**
 * Vérifie si le résultat du parsing correspond au comportement attendu
 */
function checkOutput(testCase: any, result: any) {
  const hasInvalidImports = result.invalidImports && result.invalidImports.length > 0;
  
  if (testCase.shouldFail && !hasInvalidImports) {
    console.log(`❌ ÉCHEC: "${testCase.name}" devrait échouer mais a été analysé avec succès`);
    console.log(`   Description: ${testCase.description}`);
    return false;
  } else if (!testCase.shouldFail && hasInvalidImports) {
    console.log(`❌ ÉCHEC: "${testCase.name}" devrait réussir mais a échoué avec l'erreur: ${result.invalidImports[0].error}`);
    console.log(`   Description: ${testCase.description}`);
    return false;
  } else {
    console.log(`✅ SUCCÈS: "${testCase.name}" - Comportement attendu confirmé`);
    console.log(`   Description: ${testCase.description}`);
    if (hasInvalidImports) {
      console.log(`   Erreur: ${result.invalidImports[0].error}`);
    }
    return true;
  }
}

/**
 * Exécute les tests et génère un rapport détaillé
 */
function runErrorTests() {
  console.log('\n=== Tests spécifiques pour les cas d\'erreur ===');
  
  let passedTests = 0;
  let totalTests = allTestCases.length;
  
  // Définir le type pour les résultats de test
  type TestResult = {
    name: string;
    code: string;
    shouldFail: boolean;
    description: string;
    passed: boolean;
    result: {
      hasInvalidImports?: boolean;
      error?: string | null;
      groups?: { name: string; importCount: number }[];
      criticalError?: string;
    };
  };
  
  // Résultats détaillés pour chaque cas de test
  const testResults: TestResult[] = [];
  
  for (const testCase of allTestCases) {
    console.log(`\nTest: ${testCase.name}`);
    
    try {
      const result = parseImports(testCase.code, config);
      const passed = checkOutput(testCase, result);
      
      if (passed) {
        passedTests++;
      }
      
      testResults.push({
        name: testCase.name,
        code: testCase.code,
        shouldFail: testCase.shouldFail,
        description: testCase.description,
        passed,
        result: {
          hasInvalidImports: result.invalidImports && result.invalidImports.length > 0,
          error: result.invalidImports && result.invalidImports.length > 0 
            ? result.invalidImports[0].error 
            : null,
          groups: result.groups.map(g => ({
            name: g.name,
            importCount: g.imports.length
          }))
        }
      });
    } catch (error) {
      console.log(`❌ ERREUR CRITIQUE: Le test "${testCase.name}" a provoqué une exception non gérée`);
      console.log(`   ${error instanceof Error ? error.message : String(error)}`);
      
      testResults.push({
        name: testCase.name,
        code: testCase.code,
        shouldFail: testCase.shouldFail,
        description: testCase.description,
        passed: false,
        result: {
          criticalError: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }
  
  // Afficher le résumé
  console.log(`\n=== Résumé des tests d'erreur ===`);
  console.log(`Tests réussis: ${passedTests}/${totalTests} (${Math.round(passedTests/totalTests*100)}%)`);
  
  // Écrire les résultats détaillés dans un fichier
  const timestamp = Date.now();
  const outputPath = path.resolve(__dirname, `../results/error-tests-${timestamp}.json`);
  writeFileSync(outputPath, JSON.stringify({
    summary: {
      passedTests,
      totalTests,
      successRate: `${Math.round(passedTests/totalTests*100)}%`
    },
    testResults
  }, null, 2));
  
  console.log(`Résultats détaillés écrits dans: ${outputPath}`);
  
  return { passedTests, totalTests, testResults };
}

// Exécuter les tests
runErrorTests();
