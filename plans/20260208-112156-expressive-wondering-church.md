# Plan: Review complète de la branche `refactor/ir-based-formatter`

## Contexte

La branche `refactor/ir-based-formatter` contient **9 commits**, **55 fichiers changés** (+6578/-7683 lignes). C'est un refactoring majeur : remplacement du formateur string-based par un pipeline IR, migration ESM, changement de parser (oxc), 10 nouvelles options de config, batch formatter, destructuring sorter, et refactoring du PathResolver.

**Objectif** : review exhaustive par 5 experts spécialisés pour trouver bugs, edge cases, et améliorer la fiabilité. Chaque bug trouvé est validé par un test, puis corrigé.

---

## Équipe d'experts (5 agents parallèles)

### Expert 1 — IR Pipeline (builders + printer)
**Fichiers** : `src/ir/builders.ts`, `src/ir/printer.ts`, `src/ir/types.ts`
**Tests existants** : `test/ir/builders.test.ts`, `test/ir/printer.test.ts`, `test/ir/parity.test.ts`, `test/ir/maxLineWidth.test.ts`

**Focus** :
- Vérifier `buildImportNode()` pour tous les ImportType (SIDE_EFFECT, DEFAULT, NAMED, TYPE_DEFAULT, TYPE_NAMED)
- Edge case: specifiers vides, specifiers avec `as` alias, specifiers dupliqués
- Edge case: `maxLineWidth` à la limite exacte (width == maxLineWidth vs width > maxLineWidth)
- Edge case: un seul specifier named → devrait rester single-line même sans maxLineWidth
- Vérifier le calcul de `idealWidth` pour le multiline (adjustment = 2 si max n'est pas le dernier)
- Vérifier que `blankLinesBetweenGroups: 0` ne produit pas de ligne vide parasite
- Vérifier la mesure dans `printer.ts` : multiline avec `\n` dans les text nodes
- Edge case: `alignAnchor` avec `idealWidth` undefined vs 0 vs négatif
- Edge case: groupe avec un seul import (pas d'alignement nécessaire)
- Vérifier `sortSpecs()` avec `false` (preserve order) — pas de copie mutante ?

### Expert 2 — Formatter & replaceImportLines
**Fichiers** : `src/formatter.ts`
**Tests existants** : `test/ir/parity.test.ts`, `test/parser/enforceNewlineAfterImports.test.ts`

**Focus** :
- `replaceImportLines()` : vérifier la logique startLine/endLine (off-by-one ? sur la dernière ligne)
- Edge case: imports au tout début du fichier (startLine = 0)
- Edge case: imports à la toute fin du fichier (afterLines vide)
- Edge case: fichier avec un seul import et rien d'autre
- Edge case: importRange.start == importRange.end (garde-fou déjà présent ?)
- `enforceNewlineAfterImports: false` — les lignes vides après les imports sont-elles préservées ?
- Dynamic import detection regex: `import(` dans un commentaire ou string → faux positif ?
- `formatImportsFromParser()` : que se passe-t-il si parserResult.groups est vide mais importRange est non-vide ?

### Expert 3 — Destructuring Sorter
**Fichiers** : `src/destructuring-sorter.ts`
**Tests existants** : `test/parser/destructuring-sorter.test.ts`, `test/unit/sort-destructuring-bug.test.ts`

**Focus** :
- **ObjectExpression jamais trié** — vérifier que `walk()` ne visite pas ObjectExpression (c'est le cas vu le code, mais tester le scénario)
- Edge case: destructuring avec une seule propriété → doit être ignoré (< 2)
- Edge case: propriétés computed (`[key]: value`) → `getPropertyName` retourne null, bail out
- Edge case: interface avec méthodes (`TSMethodSignature`) — est-ce correctement géré dans le tri ?
- Edge case: enum avec `TSEnumDeclaration.body.members` vs `TSEnumDeclaration.members` (OXC compat)
- `filterNonOverlapping()` : vérifier que les ranges imbriqués (nested destructuring) ne corrompent pas l'output
- Boucle d'itération (max 10) : peut-elle boucler infiniment si un sort produit le même résultat ?
- `detectIndent()` : que se passe-t-il quand la première propriété est sur la même ligne que `{` ?
- `hasInternalComments()` : un string contenant `//` serait un faux positif — tester
- ClassBody: `static` properties ignorées — vérifier que `readonly` properties sont bien triées
- ExportSpecifier avec string literals (`export { 'weird-name' as foo }`) — `getPropertyName` retourne null → bail out

### Expert 4 — Extension & Path Resolution
**Fichiers** : `src/extension.ts`, `src/utils/path-resolver.ts`
**Tests existants** : `test/path-resolver/`, `test/configLoader/`

**Focus** :
- `applyPathResolutionWithRegrouping()` : mode relative garde groupName original (fix récent) — vérifier exhaustivement
- Edge case: `currentConfig.pathResolution.mode` undefined → fallback 'relative' dans l'appel ET dans la fonction
- PathResolver : cache par workspace folder — que se passe-t-il si un mono-repo a des tsconfig différents par package ?
- `extractTsConfigPaths()` : tsconfig avec `extends` non résolu — c'est un gap connu, mais tester le comportement
- `checkFileExists()` : 15 extensions testées — potentiellement lent sur un gros workspace. Pas un bug mais noter
- Extension : `ensureExtensionEnabled()` crée un parser avec `getParserConfig()` mais `provideDocumentFormattingEdits()` utilise `getConfigForDocument()` — inconsistance ?
- Batch formatter : `formatFolder()` — vérifier que les erreurs par fichier ne cassent pas le batch entier

### Expert 5 — Configuration & Types
**Fichiers** : `src/types.ts`, `src/utils/config.ts`, `src/utils/configLoader.ts`, `tidyjs.schema.json`, `package.json`
**Tests existants** : `test/configLoader/`

**Focus** :
- Cohérence types/schema/package.json pour les 10 nouvelles options de config
- `mergeConfigs()` : spread shallow de `format` — si base a `trailingComma: 'always'` et override a `indent: 2` sans trailingComma, est-ce que base.trailingComma survit ? (oui via spread — vérifier)
- `extractVSCodeConfig()` : est-ce que `workspaceConfig.get('pathResolution')` retourne bien les aliases ?
- `computeAutoOrder()` : collision order avec valeurs négatives, décimales, string → gérées ?
- `validateRegexString()` : regex avec flags invalides → `gimsuy` autorisé, mais `d` (dotAll) est ignoré
- DEFAULT_CONFIG : `sortSpecifiers` default est `'length'` dans le code mais pas dans DEFAULT_CONFIG.format — vérifier
- `configLoader.ts` : `convertFileConfigToConfig` sans configPath (appel legacy) — backward compat OK ?
- Batch formatter config override : `removeUnusedImports: false` forcé — vérifié dans le code ?

---

## Workflow de chaque expert

1. **Lire les fichiers source** concernés + diff complet
2. **Identifier les edge cases** et bugs potentiels
3. **Écrire des tests** pour chaque edge case (dans `test/{area}/`)
4. **Exécuter les tests** (`npm run test`) pour voir s'ils passent ou échouent
5. **Si un test échoue = bug trouvé** : documenter le bug + proposer le fix
6. **Appliquer le fix** puis re-run tests pour confirmer
7. **Rapport** avec : bugs trouvés, tests ajoutés, fixes appliqués

---

## Vérification finale

Après que tous les experts ont terminé :
```bash
npm run check   # tsc --noEmit && eslint && jest (631+ tests attendus)
```

Consolidation des rapports + bilan des bugs trouvés/corrigés.

---

## Fichiers critiques

| Zone | Fichiers source | Fichiers test |
|------|----------------|---------------|
| IR Pipeline | `src/ir/builders.ts`, `src/ir/printer.ts`, `src/ir/types.ts` | `test/ir/*.test.ts` |
| Formatter | `src/formatter.ts` | `test/ir/parity.test.ts`, `test/parser/enforceNewlineAfterImports.test.ts` |
| Destructuring | `src/destructuring-sorter.ts` | `test/parser/destructuring-sorter.test.ts` |
| Extension | `src/extension.ts`, `src/utils/path-resolver.ts` | `test/path-resolver/*.test.ts` |
| Config | `src/types.ts`, `src/utils/config.ts`, `src/utils/configLoader.ts` | `test/configLoader/*.test.ts` |
