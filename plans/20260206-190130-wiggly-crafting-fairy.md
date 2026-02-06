# Plan : Refactoring du Formatter TidyJS — String Manipulation → IR-Based Printer

## Contexte

Le formatter actuel (`src/formatter.ts`) reconstruit les imports par manipulation de strings : template literals, `padEnd`, `split('\n')/join('\n')`, regex sur positions de caractères. C'est fragile et difficile à étendre. L'objectif est de remplacer cette approche par un vrai pipeline **IR (Intermediate Representation) → Two-Pass Printer** qui :
- Produit un output **identique** à l'actuel (aucune régression)
- Gère l'alignement `from` cross-statement via un IR custom (pas Wadler-Lindig pur, car l'alignement en colonnes nécessite une mesure globale)
- Soit extensible pour de futures fonctionnalités (tri de destructuring, etc.)

## Architecture Cible

```
ParsedImport[] ──→ [IR Builder] ──→ IRDocument ──→ [Printer Pass 1: Measure] ──→ AlignmentMap
                                         │                                            │
                                         └──────→ [Printer Pass 2: Render] ←──────────┘
                                                          │
                                                     String (formatted imports)
```

## Fichiers à créer

### 1. `src/ir/types.ts` — Types IR

```typescript
IRText        { kind: 'text', value: string }
IRHardLine    { kind: 'hardLine' }
IRIndent      { kind: 'indent', count: number, content: IRNode }
IRConcat      { kind: 'concat', parts: IRNode[] }
IRAlignAnchor { kind: 'alignAnchor', anchorId: string, prefix: IRNode, suffix: IRNode, idealWidth?: number }
IRAlignGroup  { kind: 'alignGroup', groupId: string, children: IRNode[] }
IRDocument    { kind: 'document', children: IRNode[] }
```

- `IRAlignAnchor` : le point d'alignement (avant/après `from`). `idealWidth` est un override pour les imports multiline où la largeur idéale dépend des specifiers, pas du `}`.
- `IRAlignGroup` : scope d'alignement partagé (= un groupe d'imports). Tous les anchors dans un group partagent la même colonne.

### 2. `src/ir/builders.ts` — Construction de l'IR depuis ParsedImport[]

Fonctions principales :
- `text()`, `hardLine()`, `indent()`, `concat()`, `alignAnchor()`, `alignGroup()`, `doc()` — constructeurs primitifs
- `buildImportNode(imp: ParsedImport, config: Config, anchorId: string): IRNode` — convertit un ParsedImport en IR. Réplique exactement la logique de branchement de l'actuel `formatImportLine()` mais produit de l'IR au lieu de strings.
- `buildGroupNode(groupName: string, imports: ParsedImport[], config: Config): IRAlignGroup` — un groupe = commentaire `// GroupName` + imports avec anchors partagés
- `buildDocument(groups: {name, imports}[], config: Config): IRDocument` — document complet avec lignes vides entre groupes + trailing newline

**Point critique** : pour les imports multiline (named/typeNamed avec 2+ specifiers), `idealWidth` = `indent + longueur du specifier le plus long + ajustement (1 ou 2 selon trailing comma)`. Cela réplique le comportement actuel de `alignImportsInGroup`.

### 3. `src/ir/printer.ts` — Algorithme Two-Pass

**Pass 1 — `measure(node: IRNode): Map<string, number>`**
- Parcourt l'IR, collecte tous les `IRAlignAnchor` par `anchorId`
- Pour chaque anchor : width = `idealWidth` override OU `measureTextWidth(prefix)`
- Résolution : `max(widths)` pour chaque anchorId

**`measureTextWidth(node: IRNode): number`**
- Pour les nodes contenant des `hardLine`, mesure seulement la dernière ligne (car c'est elle qui détermine la position de `from`)

**Pass 2 — `render(node: IRNode, resolved: Map<string, number>): string`**
- Parcourt l'IR, produit le string final
- Pour `IRAlignAnchor` : rend le prefix, pad à `resolved[anchorId]`, rend le suffix

**API publique** : `printDocument(doc: IRDocument): string`

## Fichier à modifier

### 4. `src/formatter.ts` — Refactoring

**Supprimé :**
- `formatImportLine()` → remplacé par `buildImportNode()` dans builders
- `alignFromKeyword()` → remplacé par le padding dans `render()`
- `alignMultilineFromKeyword()` → idem
- `alignImportsInGroup()` → remplacé par `measure()` du printer
- `cleanUpLines()` → la structure est correcte par construction depuis `buildDocument()`
- Imports lodash (`maxBy`, `padEnd`, `dropRightWhile`) → plus nécessaires

**Conservé :**
- `replaceImportLines()` — splicing dans le source text, pas une responsabilité de l'IR
- `formatImportsFromParser()` — devient orchestration fine : build IR → print → splice
- `formatImports()` — API publique inchangée

**Note :** `lodash` reste dans le projet (utilisé par `config.ts` et `config-cache.ts`), mais les imports dans `formatter.ts` sont supprimés.

## Fichiers à créer (tests)

### 5. `test/ir/printer.test.ts` — Tests unitaires IR

- `measureTextWidth` : vérifie les largeurs pour text, concat, indent, hardLine
- `measure()` : vérifie la collecte d'anchors et résolution max par groupe
- `render()` : vérifie le padding des anchors aux colonnes résolues
- Isolation : anchors dans des groupes différents ne partagent PAS l'alignement

### 6. `test/ir/builders.test.ts` — Tests unitaires builders

- `buildImportNode` pour chaque type d'import (sideEffect, default, named single, named multi, typeDefault, typeNamed, namespace, alias)
- `buildGroupNode` : vérifie le commentaire + anchors
- `buildDocument` : vérifie les lignes vides entre groupes

### 7. `test/ir/parity.test.ts` — Tests de parité (CRITIQUE)

Pour chaque cas, exécute BOTH l'ancien formatter ET le nouveau pipeline IR, assertant un output identique. Cas à couvrir :
- Import default simple
- Import named single specifier
- Import named multi specifiers (multiline, tri par longueur)
- Import type (typeDefault, typeNamed single et multi)
- Import side-effect
- Import namespace (`* as X`)
- Import avec alias (`foo as bar`)
- Groupes multiples avec largeurs d'alignement différentes
- Mix single-line et multiline dans le même groupe
- Configs variées (singleQuote: false, indent: 2, bracketSpacing: false)
- Cas réels des fixtures existantes (`test/test-files/`)

## Stratégie de migration

**Incrémentale, pas big-bang.**

### Phase 1 : Construire l'IR à côté (aucun changement de comportement)
1. Créer `src/ir/types.ts`
2. Créer `src/ir/builders.ts`
3. Créer `src/ir/printer.ts`
4. Créer les tests unitaires IR (`test/ir/`)
5. Créer `test/ir/parity.test.ts` — tourne les deux pipelines en parallèle
6. **Ne PAS modifier `formatter.ts`**

### Phase 2 : Valider la parité
1. Tous les tests de parité passent
2. Les tests existants passent toujours (aucun changement)

### Phase 3 : Switch
1. Refactorer `formatImportsFromParser()` pour utiliser `buildDocument() + printDocument()`
2. Supprimer les anciennes fonctions (formatImportLine, align*, cleanUpLines)
3. Supprimer les imports lodash du formatter
4. Supprimer `FormattedImportGroup` de `types.ts` si plus utilisé nulle part

### Phase 4 : Vérification
1. `npm run check` (tsc + eslint + tests)
2. Tests e2e si disponibles
3. Test idempotence (format twice → same output)

## Fichiers critiques (lecture seule, référence)

- `src/parser.ts` — types `ParsedImport`, `ImportType`, `ParserResult`, `ImportSpecifier`
- `src/types.ts` — type `Config`, `FormattedImportGroup`
- `test/parser/line-based-replacement.test.ts` — outputs attendus exacts (ex: `"import React        from 'react';"`)
- `test/parser/multiline-alignment.test.ts` — comportement d'alignement multiline
- `test/parser/double-format.test.ts` — test d'idempotence existant
