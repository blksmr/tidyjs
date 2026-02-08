# Plan: Support `as const` objects in enum member sorting

## Context

TidyJS trie les membres d'enums TypeScript quand `sortEnumMembers: true`, mais ignore les objets `as const` (`const X = { ... } as const`). Ces objets sont le remplacement moderne des enums TS et devraient être triés par le même flag.

Le fichier problématique :
```ts
export const RoleEnum = {
    SuperAdministrateur: 'Super Administrateur',
    GestionnaireDePaye: 'Gestionnaire de Paye',
} as const;
```

OXC parse ceci comme `TSAsExpression { expression: ObjectExpression, typeAnnotation: TSTypeReference { typeName: { name: "const" } } }`.

## Modifications

### 1. `src/types/ast.ts` — Ajouter les types AST manquants

Ajouter `TSAsExpression` et `ObjectExpression` :

```ts
export interface TSAsExpression extends ASTNode {
    type: 'TSAsExpression';
    expression: ASTNode;
    typeAnnotation: ASTNode;
}

export interface ObjectExpression extends ASTNode {
    type: 'ObjectExpression';
    properties: ASTNode[];
}
```

### 2. `src/destructuring-sorter.ts` — Détecter les objets `as const`

- Ajouter `'asConstObject'` au type union de `SortablePattern.kind`
- Ajouter un bloc de détection dans `walk()` (après le bloc `TSEnumDeclaration`, ~ligne 186), conditionné par `config?.format?.sortEnumMembers` :

```ts
if (config?.format?.sortEnumMembers && node.type === 'TSAsExpression' && node.range) {
    const typeAnn = (node as AST.TSAsExpression).typeAnnotation;
    // Vérifier que c'est `as const`
    if (typeAnn?.type === 'TSTypeReference' &&
        (typeAnn as any).typeName?.type === 'Identifier' &&
        (typeAnn as any).typeName?.name === 'const') {
        const expr = (node as AST.TSAsExpression).expression;
        if (expr?.type === 'ObjectExpression') {
            const objExpr = expr as AST.ObjectExpression;
            const properties = objExpr.properties;
            // Sécurité : skip si SpreadElement, méthodes, getters/setters
            if (properties?.length >= 2 &&
                properties.every((p: AST.ASTNode) => p.type === 'Property')) {
                const braceRange = findBraceRange(expr.range as [number, number], sourceText);
                if (braceRange && isMultiline(sourceText, braceRange) &&
                    !hasInternalComments(sourceText, braceRange)) {
                    const allInit = properties.every((p: AST.ASTNode) =>
                        (p as AST.Property).kind === undefined || (p as AST.Property).kind === 'init');
                    if (allInit) {
                        const props = extractProperties(properties as AST.ASTNode[], sourceText);
                        if (props && props.length >= 2) {
                            patterns.push({ kind: 'asConstObject', range: braceRange, properties: props });
                        }
                    }
                }
            }
        }
    }
}
```

Gardes de sécurité (mêmes critères que les enums) :
- Multiline requis
- Pas de commentaires internes
- Toutes les propriétés sont `Property` (pas de `SpreadElement`)
- Toutes les propriétés sont `kind: "init"` (pas de getters/setters/methods)
- Au moins 2 propriétés
- Propriétés non-computed (vérifié par `getPropertyName` → retourne `null` si computed)

### 3. `test/parser/destructuring-sorter.test.ts` — Tests

Ajouter un bloc `describe('sortEnumMembers — as const objects', ...)` avec :
1. Tri basique par longueur de nom
2. `export const X = { ... } as const` (avec export)
3. Objet `as const` single-line → ignoré (non-multiline)
4. Objet `as const` avec commentaires → ignoré
5. Objet `as const` avec spread → ignoré
6. Objet `as const` avec getter/setter → ignoré
7. Objet normal (sans `as const`) → PAS trié
8. Idempotence

## Fichiers modifiés

1. `src/types/ast.ts` — ajout types
2. `src/destructuring-sorter.ts` — détection `as const`
3. `test/parser/destructuring-sorter.test.ts` — tests

## Vérification

```bash
npm run test          # tous les tests passent
tsc --noEmit          # type check OK
npm run lint          # lint OK
```
