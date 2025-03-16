import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Script pour exécuter tous les tests du parser d'imports
 * Ce script exécute à la fois les tests standard et les tests d'erreur spécifiques
 */

// Créer le dossier results s'il n'existe pas
const resultsDir = path.resolve(__dirname, '../results');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

console.log('=== Exécution des tests du parser d\'imports ===');
console.log('Date: ' + new Date().toLocaleString());
console.log('');

// Fonction pour exécuter un fichier de test TypeScript
function runTest(testFile: string, description: string) {
  console.log(`\n=== Exécution de ${description} ===`);
  console.log(`Fichier: ${testFile}`);
  console.log('');
  
  try {
    // Exécuter le test avec ts-node
    const output = execSync(`npx ts-node ${testFile}`, { encoding: 'utf-8' });
    console.log(output);
    return true;
  } catch (error) {
    console.error(`Erreur lors de l'exécution de ${testFile}:`);
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(String(error));
    }
    return false;
  }
}

// Exécuter les tests standard
const standardTestSuccess = runTest(
  path.resolve(__dirname, './test.ts'),
  'tests standard'
);

// Exécuter les tests d'erreur spécifiques
const errorTestSuccess = runTest(
  path.resolve(__dirname, './error-test.ts'),
  'tests d\'erreur spécifiques'
);

// Afficher le résumé
console.log('\n=== Résumé des tests ===');
console.log(`Tests standard: ${standardTestSuccess ? '✅ SUCCÈS' : '❌ ÉCHEC'}`);
console.log(`Tests d'erreur: ${errorTestSuccess ? '✅ SUCCÈS' : '❌ ÉCHEC'}`);
console.log(`Résultat global: ${standardTestSuccess && errorTestSuccess ? '✅ TOUS LES TESTS ONT RÉUSSI' : '❌ CERTAINS TESTS ONT ÉCHOUÉ'}`);

// Créer un rapport de test
const timestamp = Date.now();
const reportPath = path.resolve(__dirname, `../results/test-report-${timestamp}.json`);

fs.writeFileSync(reportPath, JSON.stringify({
  timestamp,
  date: new Date().toISOString(),
  results: {
    standardTests: standardTestSuccess,
    errorTests: errorTestSuccess,
    allTestsPassed: standardTestSuccess && errorTestSuccess
  }
}, null, 2));

console.log(`\nRapport de test écrit dans: ${reportPath}`);

// Sortir avec un code d'erreur si un des tests a échoué
process.exit(standardTestSuccess && errorTestSuccess ? 0 : 1);
