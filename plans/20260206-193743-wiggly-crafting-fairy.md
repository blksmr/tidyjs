# Plan : Tri des destructuring par longueur

## Contexte

TidyJS formate actuellement uniquement les imports. L'utilisateur veut étendre le formatting à **tout pattern destructuring-like** dans le code : trier les propriétés du plus court au plus long (par nom), comme c'est déjà fait pour les specifiers d'import.

**Avant :**
```typescript
const {
    className,
    datatestIdAttribute,
    datatestId,
    classesFunctions
} = props;
```

**Après :**
```typescript
const {
    className,
    datatestId,
    classesFunctions,
    datatestIdAttribute,
} = props;
```

**Scope :** tout destructuring-like (`{ ... }`) — variables, params de fonction, arrow functions, interfaces, types.
**Config :** opt-in via `format.sortDestructuring: true` (désactivé par défaut).

## Architecture

```
Source Text ──→ [Import Formatter] ──→ formattedText ──→ [Destructuring Sorter] ──→ Final Text
                    (existant)                               (nouveau)
```

Le destructuring sorter est un **post-processing pass** indépendant qui s'applique après le formatage des imports. Il utilise `@typescript-eslint/parser` (déjà en dépendance) pour trouver les patterns, puis fait du remplacement textuel guidé par l'AST.

### Approche : AST-guided text transformation

1. Parser le texte complet avec `@typescript-eslint/parser`
2. Walker récursif sur l'AST entier, collecter tous les nœuds triables :
   - `ObjectPattern` (destructuring variable, param, arrow)
   - `TSInterfaceBody` (propriétés d'interface)
   - `TSTypeLiteral` (propriétés de type literal)
3. Filtrer : garder uniquement les patterns **multiline** avec **2+ propriétés**
4. Pour chaque pattern : extraire les propriétés, trier par longueur de nom, reconstruire
5. Appliquer les remplacements du bas vers le haut (préserver les offsets)

### Règles de tri

- Tri par longueur du **nom de la propriété** (pas l'expression complète)
- `...rest` toujours en dernier (contrainte JS)
- Propriétés avec default values (`a = 10`) : trier par le nom `a`
- Propriétés avec alias (`longName: short`) : trier par le nom clé `longName`
- Préserver l'indentation existante
- Préserver les trailing commas telles quelles
- **Skip** les patterns qui contiennent des commentaires internes (trop risqué)

## Fichiers à créer

### 1. `src/destructuring-sorter.ts`

```typescript
export function sortDestructuring(sourceText: string, config: Config): string
```

Fonctions internes :
- `findSortablePatterns(ast: TSESTree.Program): SortablePattern[]` — walker récursif
- `sortProperties(pattern: SortablePattern, sourceText: string): Replacement` — tri + reconstruction
- `applyReplacements(sourceText: string, replacements: Replacement[]): string` — application bottom-up

**Types :**
```typescript
interface SortablePattern {
    kind: 'objectPattern' | 'interfaceBody' | 'typeLiteral';
    range: [number, number];         // range dans le source
    properties: PropertyInfo[];       // infos sur chaque propriété
}

interface PropertyInfo {
    name: string;                     // nom pour le tri
    range: [number, number];          // range du texte de la propriété
    isRest: boolean;                  // ...rest
    text: string;                     // texte brut de la propriété
}

interface Replacement {
    range: [number, number];
    newText: string;
}
```

### 2. `test/parser/destructuring-sorter.test.ts`

Cas à couvrir :
- Variable destructuring multiline → trié par longueur
- Param de fonction destructuré → trié
- Arrow function destructuré → trié
- Interface properties → triées
- Type literal properties → triées
- Single-line destructuring → **non touché**
- Pattern avec `...rest` → rest en dernier
- Pattern avec defaults (`a = 10`) → trié par nom
- Pattern avec alias (`foo: bar`) → trié par nom clé
- Pattern avec commentaires internes → **skip**
- Destructuring imbriqué → chaque niveau trié indépendamment
- Idempotence (formatter 2x → même résultat)

## Fichiers à modifier

### 3. `src/types.ts` — Ajouter l'option config

```typescript
format?: {
    // ... existant
    sortDestructuring?: boolean;  // NOUVEAU — opt-in, default false
};
```

Aussi dans `TidyJSConfigFile.format`.

### 4. `src/extension.ts` — Intégrer le post-processing

Dans `provideDocumentFormattingEdits()`, après le formatage des imports (ligne ~220), ajouter :

```typescript
let finalText = formattedDocument.text;

if (currentConfig.format?.sortDestructuring) {
    finalText = sortDestructuring(finalText, currentConfig);
}
```

### 5. `package.json` — Déclarer l'option VS Code

Ajouter dans `contributes.configuration.properties` :

```json
"tidyjs.format.sortDestructuring": {
    "type": "boolean",
    "default": false,
    "description": "Sort destructured properties by name length (shortest first)"
}
```

### 6. `src/utils/config.ts` — Charger l'option

Ajouter dans `formatSettings` (ligne ~465) :
```typescript
sortDestructuring: vsConfig.get<boolean>('format.sortDestructuring'),
```

### 7. `tidyjs.schema.json` — Ajouter au schema (si existant)

Ajouter `sortDestructuring` dans la section format du schema JSON.

## Stratégie d'implémentation

### Phase 1 : Module standalone
1. Créer `src/destructuring-sorter.ts` avec toute la logique
2. Créer les tests unitaires
3. Valider que le module fonctionne en isolation

### Phase 2 : Intégration
1. Ajouter l'option config (`types.ts`, `config.ts`, `package.json`)
2. Brancher dans `extension.ts` en post-processing
3. Valider `npm run check`

### Phase 3 : Vérification
1. `npm run check` (tsc + eslint + tests)
2. Test idempotence
3. Test que le formatting d'imports n'est PAS affecté quand l'option est off

## Fichiers critiques (référence)

- `src/extension.ts:218-220` — point d'insertion du post-processing
- `src/types.ts` — Config interface
- `src/utils/config.ts:464-470` — chargement des format settings
- `package.json:44-155` — configuration contributes
- `@typescript-eslint/parser` — déjà en dépendance, produit TSESTree

## Vérification

1. `npm run check` passe
2. Tests unitaires du sorter couvrent tous les cas
3. Tests existants (468) passent toujours (aucune régression)
4. Format 2x = même résultat (idempotence)
5. Option off → aucun changement sur le code hors imports
