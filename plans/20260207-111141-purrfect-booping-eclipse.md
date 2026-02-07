# Experiment: Remplacement intégral de @typescript-eslint/parser par oxc-parser

## Contexte

TidyJS utilise `@typescript-eslint/parser` + `@typescript-eslint/types` pour parser les imports TypeScript/JavaScript. Ces dépendances sont lourdes — elles embarquent une partie du compilateur TypeScript dans le bundle esbuild (~11 MB actuellement). **OXC** est un parser Rust ~3x plus rapide, ESTree-compatible, avec ~1.4 MB de bindings natifs.

**Objectif** : Remplacer intégralement `@typescript-eslint/parser` et `@typescript-eslint/types` par `oxc-parser`, puis mesurer les gains.

---

## Fichiers à migrer

| Fichier | Usage AST | Stratégie |
|---------|-----------|-----------|
| `src/parser.ts` | `ImportDeclaration`, specifiers, `importKind`, `range` | API `StaticImport` d'OXC (sans AST walk) + AST ESTree pour `calculateImportRange` |
| `src/reexport-organizer.ts` | `ExportNamedDeclaration`, `ExportSpecifier`, `exportKind`, `range` | AST ESTree d'OXC (mêmes noms de nodes) |
| `src/destructuring-sorter.ts` | 12+ types de nodes TS (ObjectPattern, TSInterfaceBody, etc.) | AST ESTree d'OXC + types locaux (remplacent `TSESTree.*`) |
| `test/parser/typescript-parser.test.ts` | Test direct du parser AST | Adapter à l'API `parseSync` d'OXC |

### Point clé sur `destructuring-sorter.ts`

Les `TSESTree.*` sont utilisés **uniquement comme annotations de type** (casts `as TSESTree.Property`). Le runtime ne fait que vérifier `node.type` (strings ESTree standard) et accéder aux propriétés standard (`key.name`, `range`, `computed`, etc.). OXC produit le même AST ESTree → la logique runtime est identique, seul le typage change.

---

## Plan d'exécution

### Etape 1 : Setup

1. Créer la branche `experiment/oxc-parser` depuis `main`
2. `npm install oxc-parser`
3. Baseline : build production + taille de `dist/extension.js` + `npm run test`

### Etape 2 : Créer les types AST locaux

Créer `src/types/ast.ts` avec des interfaces minimales qui remplacent `TSESTree.*` :

```typescript
// Types ESTree génériques pour remplacer TSESTree
// OXC produit le même format, ces types servent uniquement de typage
export interface ASTNode {
    type: string;
    range?: [number, number];
    [key: string]: unknown;
}

export interface ASTProgram extends ASTNode {
    type: 'Program';
    body: ASTNode[];
}

export interface ASTImportDeclaration extends ASTNode {
    type: 'ImportDeclaration';
    source: { value: string };
    importKind: 'value' | 'type';
    specifiers: ASTNode[];
}

// etc. — uniquement les interfaces utilisées
```

### Etape 3 : Migrer `src/parser.ts`

1. Remplacer `import { parse } from '@typescript-eslint/parser'` → `import { parseSync } from 'oxc-parser'`
2. Supprimer `import { TSESTree } from '@typescript-eslint/types'` → utiliser les types locaux
3. **`parse()` method** :
   - `parseSync(fileName ?? 'file.tsx', sourceCode, { sourceType: 'module' })`
   - OXC ne throw pas sur les erreurs de syntaxe → checker `result.errors` et throw manuellement
4. **`extractAllImports()`** : Réécrire avec `result.module.staticImports` :
   - `staticImport.moduleRequest.value` → `source`
   - `entry.importName.kind` : `'Default'` | `'Name'` | `'NamespaceObject'`
   - `entry.isType` → couvre `import type { X }` ET `import { type X }`
   - `entry.localName.value` → `local.name`
   - `entry.importName.name` → `imported.name`
   - `[staticImport.start, staticImport.end]` → `range`
5. **`calculateImportRange()`** : Utiliser `result.program.body`, filtrer `type === 'ImportDeclaration'`, lire `range`

### Etape 4 : Migrer `src/reexport-organizer.ts`

1. Remplacer `parse()` → `parseSync()`, `TSESTree` → types locaux
2. `parseSync` retourne `{ program, errors }` → extraire `program`
3. Les nodes `ExportNamedDeclaration`, `ExportSpecifier` ont les mêmes noms et propriétés en ESTree
4. Adapter : `node.source`, `node.exportKind`, `node.specifiers`, `s.exported.name`, `s.local.name`

### Etape 5 : Migrer `src/destructuring-sorter.ts`

1. Remplacer `parse()` → `parseSync()`, `TSESTree` → types locaux
2. La fonction `walk()` vérifie `node.type` (strings) → identique en ESTree OXC
3. Les propriétés accédées (`key.name`, `computed`, `body`, `members`, `properties`, `specifiers`, `range`, `static`, `id.name`) sont standard ESTree
4. Seul point d'attention : `TSEnumDeclaration.body?.members ?? enumNode.members` — vérifier que OXC utilise la même structure

### Etape 6 : Adapter esbuild

Dans `scripts/esbuild.js` :
```diff
- external: ['vscode'],
+ external: ['vscode', 'oxc-parser'],
```

### Etape 7 : Adapter les tests

**`test/parser/typescript-parser.test.ts`** :
- Remplacer `parse()` par `parseSync()`
- `parseSync` retourne `{ program, errors }` au lieu de l'AST directement
- Les tests "should throw" doivent vérifier `result.errors.length > 0` au lieu de `.toThrow()`
- Les tests d'AST valide restent identiques (mêmes `node.type`, mêmes propriétés)

**Autres tests** : Aucun changement — ils testent `ParsedImport[]` / `ParserResult`, pas l'AST.

### Etape 8 : Supprimer les anciennes dépendances

```bash
npm uninstall @typescript-eslint/parser @typescript-eslint/types
```

Vérifier que `typescript-eslint` (ESLint config) n'est pas impacté — c'est un package séparé qui n'utilise pas `@typescript-eslint/parser` comme dépendance runtime.

### Etape 9 : Mesurer les gains

1. `node scripts/esbuild.js --production && ls -la dist/extension.js` → comparer avec baseline
2. `npm run check` (tsc + lint + tests)
3. Documenter les résultats

---

## Fichiers critiques

| Fichier | Modification |
|---------|-------------|
| `src/parser.ts` | Remplacement complet : `parse` → `parseSync`, `TSESTree` → types locaux, `extractAllImports` réécrit |
| `src/reexport-organizer.ts` | `parse` → `parseSync`, typage adapté |
| `src/destructuring-sorter.ts` | `parse` → `parseSync`, typage adapté |
| `src/types/ast.ts` | **Nouveau** — types ESTree locaux (remplacent TSESTree) |
| `scripts/esbuild.js` | Ajouter `oxc-parser` aux externals |
| `package.json` | +`oxc-parser`, -`@typescript-eslint/parser`, -`@typescript-eslint/types` |
| `test/parser/typescript-parser.test.ts` | Adapter à l'API OXC |

## Risques

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| `StaticImport` ne couvre pas un cas edge | Moyen | Fallback vers AST walk ESTree |
| Différences AST ESTree d'OXC vs typescript-eslint (champs manquants/renommés) | Moyen | Les 50+ tests existants valideront la parité |
| `TSEnumDeclaration.body?.members` diffère dans OXC | Faible | Tester et adapter le fallback |
| OXC ne throw pas sur erreurs de syntaxe | Faible | Wrapper qui check `errors[]` et throw |
| NAPI binaries et `.vsix` packaging | Hors scope spike | On mesure le JS bundle, packaging séparé |

## Verification

1. `npm run test` — tous les tests passent
2. `tsc --noEmit` — pas d'erreurs de type
3. `npm run lint` — pas d'erreurs de lint
4. Comparer la taille de `dist/extension.js` avant/après
5. `npm run check` — validation complète
