# Experiment: Migration vers oxc-parser

## Contexte

TidyJS utilise `@typescript-eslint/parser` + `@typescript-eslint/types` pour parser les imports TypeScript/JavaScript. Ces dépendances sont lourdes (elles embarquent une partie du compilateur TypeScript dans le bundle esbuild). **OXC** est un parser Rust ~3x plus rapide, avec un output ESTree-compatible et une API `StaticImport` qui fournit les métadonnées d'import sans parcourir l'AST.

**Objectif** : Valider la faisabilité de la migration et mesurer les gains (taille du bundle `.vsix` et performance de parsing).

---

## Scope de l'expérimentation

### Fichiers qui importent `@typescript-eslint/parser` :

| Fichier | Complexité AST | Action |
|---------|---------------|--------|
| `src/parser.ts` | Faible (ImportDeclaration seulement) | **Migrer** |
| `src/reexport-organizer.ts` | Moyenne (ExportNamedDeclaration) | **Migrer** |
| `src/destructuring-sorter.ts` | Haute (12+ node types TS-specific) | **Ne pas migrer** — documenter la compatibilité |
| `test/parser/typescript-parser.test.ts` | Test direct du parser | **Adapter** |

---

## Plan d'exécution

### Etape 1 : Setup

1. Créer la branche `experiment/oxc-parser` depuis `main`
2. `npm install oxc-parser` (NAPI bindings — inclut fallback WASM automatique)
3. Mesurer la baseline :
   - `node scripts/esbuild.js --production && ls -la dist/extension.js` → taille actuelle
   - `npm run test` → tous les tests passent

### Etape 2 : Migrer `src/parser.ts`

**Stratégie** : Utiliser `result.module.staticImports` pour `extractAllImports()`, et `result.program.body` (AST ESTree) pour `calculateImportRange()`.

Modifications dans `src/parser.ts` :

1. **Remplacer les imports** :
   ```diff
   - import { parse } from '@typescript-eslint/parser';
   - import { TSESTree } from '@typescript-eslint/types';
   + import { parseSync } from 'oxc-parser';
   + import type { StaticImport, StaticImportEntry } from 'oxc-parser';
   ```

2. **Champ `ast`** : Remplacer `private ast!: TSESTree.Program` par le résultat OXC stocké.

3. **Méthode `parse()`** :
   ```typescript
   const result = parseSync(fileName ?? 'file.tsx', sourceCode, {
       sourceType: 'module',
       lang: shouldEnableJSX ? 'tsx' : 'ts',  // ou 'jsx'/'js'
   });
   if (result.errors.length > 0) { /* handle */ }
   ```

4. **`extractAllImports()`** — Réécrire avec `staticImports` :
   - `staticImport.moduleRequest.value` → `source`
   - `staticImport.entries` → classifier par `importName.kind` (Default/Name/NamespaceObject) et `isType`
   - `[staticImport.start, staticImport.end]` → `range` pour extraire `raw`
   - Mapping complet :
     - `entry.importName.kind === 'Default'` → `ImportDefaultSpecifier`
     - `entry.importName.kind === 'Name'` → `ImportSpecifier`
     - `entry.importName.kind === 'NamespaceObject'` → `ImportNamespaceSpecifier`
     - `entry.isType` → couvre `import type { X }` ET `import { type X }`
     - `entry.importName.name` → `imported.name`
     - `entry.localName.value` → `local.name`
   - Pour les aliases (`import { X as Y }`): `entry.importName.name !== entry.localName.value`

5. **`calculateImportRange()`** — Utiliser l'AST ESTree via `result.program.body` :
   - Parcourir `program.body`, filtrer `node.type === 'ImportDeclaration'`, lire `node.range`
   - Identique à la logique actuelle, juste typage différent (pas de `TSESTree`)

6. **Supprimer** les types `TSESTree` — utiliser des types locaux simples ou `any` pour l'AST walk de `calculateImportRange`.

### Etape 3 : Adapter esbuild

Dans `scripts/esbuild.js` :
```diff
- external: ['vscode'],
+ external: ['vscode', 'oxc-parser'],
```
`oxc-parser` contient des binaires NAPI natifs, ne peut pas être bundlé par esbuild.

### Etape 4 : Migrer `src/reexport-organizer.ts`

Même approche :
- Remplacer `parse()` par `parseSync()`
- Utiliser `result.program.body` pour trouver les `ExportNamedDeclaration` avec `source !== null`
- Les noms de nodes ESTree sont identiques (`ExportNamedDeclaration`, `ExportSpecifier`)
- Adapter le typage (remplacer `TSESTree.*` par des types locaux)

### Etape 5 : Adapter les tests

- `test/parser/typescript-parser.test.ts` : Remplacer l'import de `@typescript-eslint/parser` par `oxc-parser`
- Tous les autres tests (`test/parser/*.test.ts`, `test/ir/*.test.ts`) testent `ParsedImport[]` ou `ParserResult` — ils ne devraient pas changer

### Etape 6 : Mesurer les gains

1. **Taille du bundle** : `node scripts/esbuild.js --production && ls -la dist/extension.js`
   - Attendu : réduction significative (plus de `@typescript-eslint/*` ni `typescript` dans le bundle)
2. **Tests** : `npm run test && npm run check`
3. **Compatibilité** : Vérifier manuellement avec des cas edge (mixed imports, type imports, namespace imports, aliases)

### Etape 7 : Evaluer `destructuring-sorter.ts`

**Ne pas migrer**, mais documenter :
- Parser un fichier TS avec OXC et vérifier que les nodes `TSInterfaceBody`, `TSTypeLiteral`, `TSEnumDeclaration`, `ObjectPattern`, `ClassBody`, `PropertyDefinition`, `TSPropertySignature`, `TSMethodSignature`, `TSEnumMember`, `TSIndexSignature` existent dans l'AST
- Documenter les éventuelles différences de noms de champs

---

## Fichiers critiques

| Fichier | Modification |
|---------|-------------|
| `src/parser.ts` | Migration complète : `@typescript-eslint/parser` → `oxc-parser` |
| `src/reexport-organizer.ts` | Migration : `parse()` → `parseSync()`, typage adapté |
| `scripts/esbuild.js` | Ajouter `oxc-parser` aux externals |
| `package.json` | Ajouter `oxc-parser`, conserver `@typescript-eslint/*` (pour destructuring-sorter) |
| `test/parser/typescript-parser.test.ts` | Adapter les imports et assertions |

## Risques

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| `StaticImport` ne couvre pas un cas edge | Moyen | Fallback vers AST walk ESTree (OXC le supporte aussi) |
| Différences subtiles dans l'AST ESTree d'OXC | Moyen | Les tests existants valideront la parité |
| NAPI binaries et `.vsix` packaging | Hors scope | On mesure la taille du JS bundle uniquement, packaging `.vsix` est un problème séparé |
| `destructuring-sorter.ts` reste sur `@typescript-eslint/parser` | Faible | Les deux parsers coexistent, pas de conflit |

## Verification

1. `npm run test` — tous les tests passent
2. `tsc --noEmit` — pas d'erreurs de type
3. `npm run lint` — pas d'erreurs de lint
4. Comparer la taille de `dist/extension.js` avant/après
5. Test manuel de l'extension sur un fichier avec des imports mixtes
