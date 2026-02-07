# Plan: Ignore Pragma + Re-export Organization

## Context

TidyJS n'a aucun mécanisme pour désactiver le formatage sur un fichier spécifique, et ne gère pas les re-exports (`export { foo } from './bar'`). On ajoute :
1. `// tidyjs-ignore` — pragma fichier pour skip le formatage
2. Organisation des re-exports — groupement, tri, alignement `from`

---

## Feature 1: Ignore Pragma

### Étape 1.1 — Check pragma dans extension.ts
- **Fichier**: `src/extension.ts`
- Ajouter une fonction `hasIgnorePragma(text: string): boolean`
  - Regex: `/^\s*\/\/\s*tidyjs-ignore\s*$/m`
  - Matche `// tidyjs-ignore` sur une ligne dédiée, n'importe où dans le fichier
- Appeler après `const documentText = document.getText()` (ligne 52)
- Si true → `logDebug('...skipped: tidyjs-ignore pragma')` + `return undefined`

### Étape 1.2 — Tests
- **Fichier**: `test/parser/ignore-pragma.test.ts`
- Cas: pragma en première ligne, pragma avec espaces, pragma au milieu du fichier, pragma comme sous-chaîne (ne matche PAS), absence de pragma, pragma dans un commentaire block `/* tidyjs-ignore */` (ne matche PAS)

---

## Feature 2: Re-export Organization

### Étape 2.1 — Config: ajouter `organizeReExports`
- **`src/types.ts`**: ajouter `organizeReExports?: boolean` dans `Config.format` et `TidyJSConfigFile.format`
- **`src/utils/config.ts`**: ajouter `organizeReExports: false` dans `DEFAULT_CONFIG.format`
- **`src/utils/config.ts`**: ajouter `organizeReExports: vsConfig.get<boolean>('format.organizeReExports')` dans `loadConfiguration()` (ligne ~472)
- **`package.json`**: ajouter setting `tidyjs.format.organizeReExports` (boolean, default false)
- **`tidyjs.schema.json`**: ajouter `organizeReExports` dans `format.properties`

### Étape 2.2 — Adapter ParsedImport et IR builders
- **`src/parser.ts`**: ajouter `isReExport?: boolean` à l'interface `ParsedImport` (ligne 68)
- **`src/ir/builders.ts`**: modifier `buildImportNode` pour supporter `isReExport`
  - Introduire `const keyword = imp.isReExport ? 'export' : 'import';`
  - Remplacer les string literals `import ` par `${keyword} ` dans tous les cas (default, named, type, multiline)
  - Le side-effect case ne s'applique pas aux re-exports (pas de changement)

### Étape 2.3 — Créer le re-export organizer
- **Nouveau fichier**: `src/reexport-organizer.ts`
- Fonction principale: `organizeReExports(sourceText: string, config: Config): string`
- Pipeline:
  1. Parser avec `@typescript-eslint/parser` (mêmes options que destructuring-sorter)
  2. Walker l'AST pour trouver les `ExportNamedDeclaration` avec `source` (= re-exports)
  3. Grouper les re-exports contiguës en blocs (séparés par d'autres statements)
  4. Pour chaque bloc:
     a. Convertir en `ParsedImport[]` avec `isReExport: true`, type NAMED ou TYPE_NAMED
     b. Créer `GroupMatcher` depuis `config.groups`, déterminer les groupes
     c. Organiser en groupes (même logique que `organizeImportsIntoGroups` mais simplifiée — pas de consolidation car les re-exports ne sont pas mixtes)
     d. Trier: par type (named avant type_named), puis alphabétiquement par source
     e. Construire IR: `buildDocument(groups, config)` → `printDocument(irDocument)`
     f. Remplacer le bloc dans le source (calcul de range start/end)
  5. Appliquer les remplacements bottom-up (comme destructuring-sorter)
- Error handling: try/catch, retourner le texte original si parsing échoue

### Étape 2.4 — Intégrer dans extension.ts
- **`src/extension.ts`**: ajouter l'import de `organizeReExports`
- Dans le post-processing (ligne 228-234), ajouter:
  ```typescript
  if (currentConfig.format?.organizeReExports) {
      finalText = organizeReExports(finalText, currentConfig);
  }
  ```

### Étape 2.5 — Tests
- **Nouveau fichier**: `test/parser/reexport-organizer.test.ts`
- Cas:
  - Bloc simple de re-exports → groupés et triés
  - Re-exports mixtes (named + type) → type après named
  - Alignement du `from` keyword
  - Multiline re-exports (`export { a, b, c } from './foo'` avec beaucoup de specifiers)
  - Re-exports mélangés avec du code → chaque bloc traité indépendamment
  - Barrel file (100% re-exports)
  - Fichier sans re-exports → texte inchangé
  - Feature désactivée (`organizeReExports: false`) → pas de changement

---

## Vérification

1. `tsc --noEmit` — pas d'erreurs de type
2. `npm run lint` — pas d'erreurs ESLint
3. `npm run test` — tous les tests passent (existants + nouveaux)
4. Test manuel: créer un fichier .ts avec `// tidyjs-ignore` → vérifier que le formatage est skippé
5. Test manuel: créer un barrel file avec des re-exports désordonnés → vérifier le groupement/tri/alignement

---

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `src/extension.ts` | Ignore pragma check + intégration re-export organizer |
| `src/types.ts` | `organizeReExports` dans format config |
| `src/parser.ts` | `isReExport` dans ParsedImport |
| `src/ir/builders.ts` | Support `export` keyword via `isReExport` |
| `src/reexport-organizer.ts` | **Nouveau** — logique principale |
| `src/utils/config.ts` | Default config + VS Code settings |
| `package.json` | Setting VS Code |
| `tidyjs.schema.json` | Schema validation |
| `test/parser/ignore-pragma.test.ts` | **Nouveau** — tests pragma |
| `test/parser/reexport-organizer.test.ts` | **Nouveau** — tests re-exports |
