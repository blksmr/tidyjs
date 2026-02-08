# Plan: 5 Formatting Features pour TidyJS

## Contexte

TidyJS formate les imports via un pipeline IR : `ParsedImport[] → IR Builder → IRDocument → Two-Pass Printer → String`. Les 5 features ajoutent des options de formatage configurables au niveau du `format` de la config.

## Ordre d'implémentation

1. **enforceNewlineAfterImports** — isolé dans `formatter.ts`, aucune interaction
2. **blankLinesBetweenGroups** — isolé dans `buildDocument()`, trivial
3. **trailingComma** — `buildImportNode()` multiline, modifie idealWidth
4. **sortSpecifiers** — `buildImportNode()`, extrait la logique de tri en helper
5. **maxLineWidth** — restructure la décision single/multiline, dépend de 3 et 4

---

## Fichiers communs à CHAQUE feature (config plumbing)

Pour chaque feature, ajouter la propriété dans :
- `src/types.ts` → interfaces `Config.format` (l.20-31) ET `TidyJSConfigFile.format` (l.63-74)
- `src/utils/config.ts` → `DEFAULT_CONFIG.format` (l.23-30) + `formatSettings` dans `loadConfiguration()` (l.465-476)
- `package.json` → `contributes.configuration.properties` (après l.162)
- `tidyjs.schema.json` → `format.properties` (l.97-149)

---

## Feature 8: enforceNewlineAfterImports

**Config**: `format.enforceNewlineAfterImports?: boolean` (default: `true`)

### Comportement
- `true` (défaut, comportement actuel) : exactement 1 ligne vide entre le dernier import et le code suivant
- `false` : ne pas toucher à l'espacement après les imports

### Modifications

**`src/types.ts`** — ajouter `enforceNewlineAfterImports?: boolean` aux deux interfaces format

**`src/utils/config.ts`** — `DEFAULT_CONFIG.format.enforceNewlineAfterImports: true` + `formatSettings`

**`package.json`**
```json
"tidyjs.format.enforceNewlineAfterImports": {
  "type": "boolean",
  "default": true,
  "description": "Ensure exactly one blank line between the last import and the following code"
}
```

**`tidyjs.schema.json`** — ajouter dans `format.properties`

**`src/formatter.ts`** — modifier `replaceImportLines()` :
- Ajouter paramètre `config: Config`
- Extraire `const enforce = config.format?.enforceNewlineAfterImports !== false;`
- Conditionner le stripping des lignes vides de `afterLines` et l'ajout de la ligne vide finale à `enforce`
- Mettre à jour les 2 appels (l.93 et l.125) pour passer `config`

### Tests — `test/parser/enforceNewlineAfterImports.test.ts` (nouveau)
- `true` : une ligne vide entre imports et code
- `true` : lignes vides multiples réduites à une
- `true` : pas de ligne vide → en ajoute une
- `false` : espacement existant préservé
- `false` : pas de ligne vide → reste collé
- `undefined` : se comporte comme `true`
- Fichier se terminant par des imports (avec/sans enforce)

### Vérification
`npm run check` (type + lint + tests)

---

## Feature 5: blankLinesBetweenGroups

**Config**: `format.blankLinesBetweenGroups?: number` (default: `1`)

### Comportement
- `0` : pas de ligne vide (groupes adjacents, juste un `\n`)
- `1` (défaut, actuel) : une ligne vide (`\n\n`)
- `2+` : N lignes vides

### Modifications

**`src/types.ts`** — `blankLinesBetweenGroups?: number`

**`src/utils/config.ts`** — default: `1`

**`package.json`**
```json
"tidyjs.format.blankLinesBetweenGroups": {
  "type": "integer",
  "default": 1,
  "minimum": 0,
  "description": "Number of blank lines between import groups"
}
```

**`src/ir/builders.ts`** — modifier `buildDocument()` l.171-176 :
```typescript
if (i > 0) {
    const blankLines = Math.max(0, config.format?.blankLinesBetweenGroups ?? 1);
    for (let j = 0; j < 1 + blankLines; j++) {
        children.push(hardLine());
    }
}
```
Logique : 1 hardLine pour terminer la ligne précédente + N hardLines pour N lignes vides.

### Tests — ajouter dans `test/ir/builders.test.ts`
- `blankLinesBetweenGroups: 0` → groupes sans ligne vide
- `blankLinesBetweenGroups: 1` → une ligne vide (actuel)
- `blankLinesBetweenGroups: 2` → deux lignes vides
- `undefined` → défaut = 1
- Un seul groupe → aucun effet

### Vérification
`npm run check`

---

## Feature 3: trailingComma

**Config**: `format.trailingComma?: 'always' | 'never'` (default: `'always'`)

### Comportement
- `'always'` : virgule après le dernier specifier en multiline
- `'never'` : pas de virgule après le dernier (comportement actuel)

**Note** : le default `'always'` change le comportement actuel. C'est voulu.

### Modifications

**`src/types.ts`** — `trailingComma?: 'always' | 'never'`

**`src/utils/config.ts`** — default: `'always'`

**`package.json`**
```json
"tidyjs.format.trailingComma": {
  "type": "string",
  "enum": ["always", "never"],
  "default": "always",
  "description": "Trailing comma on the last specifier in multiline imports"
}
```

**`src/ir/builders.ts`** — modifier `buildImportNode()`, branche multiline (l.110-112) :
```typescript
const trailingComma = config.format?.trailingComma ?? 'always';
const middleLines = sortedSpecifiers.map((spec, i) => {
    const isLast = i === sortedSpecifiers.length - 1;
    const comma = isLast ? (trailingComma === 'always' ? ',' : '') : ',';
    return `${indentStr}${spec}${comma}`;
});
```

**Impact sur idealWidth** (l.119-122) : avec `'always'`, le dernier specifier a aussi une virgule, donc :
```typescript
const adjustment = (trailingComma === 'always' || !isLastSpec) ? 2 : 1;
```

**Parity tests** (`test/ir/parity.test.ts`) : ajouter `trailingComma: 'never'` aux configs de test pour maintenir la comparaison avec l'ancien pipeline.

### Tests — ajouter dans `test/ir/builders.test.ts`
- `trailingComma: 'always'` → virgule sur le dernier specifier
- `trailingComma: 'never'` → pas de virgule (comportement actuel)
- `undefined` → défaut = `'always'`
- 2 specifiers avec chaque mode
- Re-export multiline

### Vérification
`npm run check`

---

## Feature 1: sortSpecifiers

**Config**: `format.sortSpecifiers?: 'length' | 'alpha' | false` (default: `'length'`)

### Comportement
- `'length'` : tri par longueur ascendante (actuel)
- `'alpha'` : tri alphabétique case-insensitive
- `false` : ordre original préservé

### Modifications

**`src/types.ts`** — `sortSpecifiers?: 'length' | 'alpha' | false`

**`src/utils/config.ts`** — default: `'length'`

**`package.json`**
```json
"tidyjs.format.sortSpecifiers": {
  "oneOf": [
    { "type": "string", "enum": ["length", "alpha"] },
    { "type": "boolean", "enum": [false] }
  ],
  "default": "length",
  "description": "Sort import specifiers: 'length' by string length, 'alpha' alphabetically, false to preserve order"
}
```

**`src/ir/builders.ts`** — extraire un helper + l'utiliser :
```typescript
function sortSpecs(specifiers: string[], config: Config): string[] {
    const mode = config.format?.sortSpecifiers ?? 'length';
    if (mode === 'length') {
        return [...specifiers].sort((a, b) => a.length - b.length);
    }
    if (mode === 'alpha') {
        return [...specifiers].sort((a, b) =>
            a.toLowerCase().localeCompare(b.toLowerCase())
        );
    }
    return specifiers; // false
}
```

Remplacer l.104 (`Array.from(specifiersSet).sort(...)`) par `sortSpecs(Array.from(specifiersSet), config)`.

### Tests — ajouter dans `test/ir/builders.test.ts`
- `'length'` : `['useCallback', 'FC', 'useState']` → `['FC', 'useState', 'useCallback']`
- `'alpha'` : `['useState', 'FC', 'useEffect']` → `['FC', 'useEffect', 'useState']`
- `false` : ordre original préservé
- `undefined` → défaut = `'length'`
- Aliased specifiers : `'foo as bar'` trié par la string complète
- Dedup fonctionne quel que soit le mode

### Vérification
`npm run check`

---

## Feature 2: maxLineWidth

**Config**: `format.maxLineWidth?: number` (default: `0` = désactivé)

### Comportement
- `0`/`undefined` : comportement actuel (1 specifier = single-line, 2+ = multiline)
- `> 0` : single-line si la largeur totale ≤ maxLineWidth, multiline sinon
- Multilines qui tiendraient sur une ligne → repliées en single-line
- Le calcul se fait sur la largeur **avant** padding d'alignement (pas de dépendance circulaire)

### Modifications

**`src/types.ts`** — `maxLineWidth?: number`

**`src/utils/config.ts`** — PAS dans DEFAULT_CONFIG (désactivé par défaut)

**`package.json`**
```json
"tidyjs.format.maxLineWidth": {
  "type": "integer",
  "default": 0,
  "minimum": 0,
  "description": "Maximum line width for imports (0 = disabled). Imports exceeding this wrap to multiline; multiline imports fitting within collapse to single-line."
}
```

**`src/ir/builders.ts`** — restructurer la branche named/typeNamed de `buildImportNode()` :

Fusionner les branches `specifiers.length === 1` (l.89-96) et `specifiers.length > 1` (l.98-130) en une seule logique unifiée :

```typescript
if (type === ImportType.NAMED || type === ImportType.TYPE_NAMED) {
    const typePrefix = type === ImportType.TYPE_NAMED ? 'type ' : '';
    const formattedSpecs = specifiers.map(specToString);
    const uniqueSpecs = Array.from(new Set(formattedSpecs));
    const sorted = sortSpecs(uniqueSpecs, config);

    const maxLineWidth = config.format?.maxLineWidth;
    const trailingComma = config.format?.trailingComma ?? 'always';

    // Calculer la largeur single-line
    const specStr = sorted.join(', ');
    const singlePrefix = `${keyword} ${typePrefix}{${bracketSpace}${specStr}${bracketSpace}} `;
    const singleSuffix = `from ${quote}${source}${quote};`;
    const singleWidth = singlePrefix.length + singleSuffix.length;

    // Décision : single-line ou multiline ?
    const useMultiline = maxLineWidth && maxLineWidth > 0
        ? singleWidth > maxLineWidth
        : sorted.length > 1;

    if (!useMultiline) {
        return alignAnchor(groupId, text(singlePrefix), text(singleSuffix));
    }

    // Multiline (logique existante avec trailingComma + sortSpecs)
    // ... firstLine, middleLines, idealWidth, etc.
}
```

### Tests — `test/ir/maxLineWidth.test.ts` (nouveau)
- `0` (désactivé) : multi-specifier = toujours multiline
- `undefined` : idem
- `80` : import court → single-line, import long → multiline
- `120` : 3 specifiers tiennent sur une ligne
- `30` : même un seul long specifier → multiline
- Interaction avec `trailingComma` (n'affecte pas le calcul single-line)
- Interaction avec `sortSpecifiers` (le tri change l'ordre du join)
- typeNamed imports
- Default/side-effect imports non affectés
- Re-exports

### Vérification
`npm run check`

---

## Résumé des fichiers modifiés

| Feature | types.ts | config.ts | package.json | schema.json | builders.ts | formatter.ts | Tests |
|---------|----------|-----------|--------------|-------------|-------------|--------------|-------|
| 8. enforceNewline | format prop | default + load | setting | prop | — | replaceImportLines | nouveau fichier |
| 5. blankLines | format prop | default + load | setting | prop | buildDocument | — | builders.test.ts |
| 3. trailingComma | format prop | default + load | setting | prop | buildImportNode | — | builders.test.ts + parity |
| 1. sortSpecifiers | format prop | default + load | setting | prop | sortSpecs helper | — | builders.test.ts |
| 2. maxLineWidth | format prop | load (pas default) | setting | prop | restructure named | — | nouveau fichier |

## Vérification finale

Après les 5 features : `npm run check` (tsc + eslint + jest). Tester manuellement dans VS Code avec différentes configs `.tidyjsrc`.
