# Plan : Commande "Format Folder" récursive

## Contexte

L'utilisateur veut pouvoir formater en masse tous les fichiers TS/JS d'un dossier (et sous-dossiers) via un clic droit dans l'Explorer VS Code. Cas d'usage principal : monorepo où chaque app a sa propre `tidyjs.json`. La sécurité est critique — aucun fichier ne doit être corrompu.

## Approche

Créer un nouveau fichier `src/batch-formatter.ts` contenant la logique pure (discovery + formatting), et brancher une commande `tidyjs.formatFolder` dans `extension.ts` avec menu contextuel Explorer.

## Fichiers à modifier/créer

| Fichier | Action | Lignes ~estimées |
|---------|--------|-----------------|
| `src/batch-formatter.ts` | **CRÉER** | ~180 lignes |
| `src/extension.ts` | Modifier | ~50 lignes ajoutées |
| `src/utils/config.ts` | Modifier | ~15 lignes (ajout `getConfigForUri`) |
| `package.json` | Modifier | ~15 lignes (command + menus) |
| `test/unit/batch-formatter.test.ts` | **CRÉER** | ~150 lignes |

## Étapes d'implémentation

### 1. `src/utils/config.ts` — Ajouter `getConfigForUri(uri)`

Refactorer `getConfigForDocument(document: TextDocument)` pour extraire la logique dans une nouvelle méthode `getConfigForUri(uri: vscode.Uri)` qui prend un URI au lieu d'un TextDocument. L'existant `getConfigForDocument` délègue à `getConfigForUri(document.uri)`.

```typescript
public async getConfigForUri(uri: vscode.Uri): Promise<Config> {
    // Même logique que getConfigForDocument mais avec uri directement
    // Réutilise: ConfigLoader.getConfigForDocument(uri), mergeConfigs, computeAutoOrder, getAllGroupsForConfig
}

public async getConfigForDocument(document: vscode.TextDocument): Promise<Config> {
    return this.getConfigForUri(document.uri);
}
```

### 2. `src/batch-formatter.ts` — Core logic (nouveau fichier)

**Types exportés :**
```typescript
export interface BatchFormatResult {
    formatted: number;    // fichiers modifiés
    skipped: number;      // fichiers non modifiés (déjà OK, ignorés, etc.)
    errors: { filePath: string; error: string }[];
    totalFiles: number;
}

export interface BatchFormatCallbacks {
    onProgress: (current: number, total: number, filePath: string) => void;
    isCancelled: () => boolean;
    createUri: (filePath: string) => vscode.Uri;
}
```

**Constantes :**
- `SUPPORTED_EXTENSIONS`: `.ts`, `.tsx`, `.js`, `.jsx`
- `ALWAYS_SKIP_DIRS`: `node_modules`, `.git`, `dist`, `build`, `out`, `.next`, `coverage`, `.cache`, `.turbo`

**Fonctions internes :**

1. **`discoverFiles(folderPath: string): Promise<string[]>`**
   - Walk récursif avec `fs.promises.readdir({ withFileTypes: true })`
   - Skip `ALWAYS_SKIP_DIRS`
   - Collecte fichiers avec `SUPPORTED_EXTENSIONS`
   - Protection anti-symlink circulaire avec `Set<string>` de realpath

2. **`isFileInExcludedFolder(filePath, config, workspaceRoot): boolean`**
   - Calcule le chemin relatif, normalise les slashes
   - Vérifie `config.excludedFolders` avec prefix matching (même logique que `isDocumentInExcludedFolder` de `extension.ts`)

3. **`createBatchConfig(config: Config): Config`**
   - Clone la config et force :
     - `removeUnusedImports: false` (nécessite diagnostics VS Code)
     - `removeMissingModules: false` (nécessite diagnostics VS Code)
     - `pathResolution.enabled: false` (nécessite contexte workspace)

4. **`formatSingleFile(filePath, config, parserCache): Promise<{ changed: boolean; error?: string }>`**
   - `fs.promises.readFile(filePath, 'utf8')`
   - Skip si vide ou contient `// tidyjs-ignore` (regex inline, pas d'import partagé)
   - Obtient/crée un `ImportParser` depuis le cache (clé = config sérialisée)
   - `parser.parse(sourceText)` → si `invalidImports`, skip avec erreur
   - `formatImports(sourceText, config, parserResult)` → si error, skip
   - Post-processing : `sortDestructuring()`, `organizeReExports()` si activés
   - **Validation critique** : si le fichier original s'est parsé sans erreur mais que le résultat formaté échoue au parse → NE PAS écrire, rapporter erreur
   - Si `finalText === sourceText` → `{ changed: false }`
   - Sinon `fs.promises.writeFile(filePath, finalText, 'utf8')` → `{ changed: true }`

5. **`formatFolder(folderPath, workspaceRoot, callbacks): Promise<BatchFormatResult>`** (exporté)
   - Clear du ConfigLoader cache pour fraîcheur
   - `discoverFiles(folderPath)`
   - Boucle séquentielle sur chaque fichier :
     - Vérifie `isCancelled()`
     - Appelle `onProgress()`
     - Charge config via `configManager.getConfigForUri(createUri(filePath))`
     - Vérifie `isFileInExcludedFolder`
     - Appelle `formatSingleFile`
     - Agrège les résultats
   - Finally : dispose tous les parsers du cache

### 3. `package.json` — Command + Menu contextuel

```json
"commands": [
  ... existants ...,
  {
    "command": "tidyjs.formatFolder",
    "title": "Format Folder",
    "category": "TidyJS"
  }
],
"menus": {
  "explorer/context": [
    {
      "command": "tidyjs.formatFolder",
      "when": "explorerResourceIsFolder",
      "group": "2_workspace"
    }
  ]
}
```

### 4. `src/extension.ts` — Enregistrement de la commande

Dans `activate()`, ajouter :
- `commands.registerCommand('tidyjs.formatFolder', handler)`
- Le handler :
  1. Si pas de `folderUri` (palette) → `showOpenDialog({ canSelectFolders: true })`
  2. `window.withProgress({ location: Notification, cancellable: true })` avec :
     - Import de `formatFolder` depuis `batch-formatter.ts`
     - Appel `formatFolder(folderUri.fsPath, workspaceRoot, callbacks)`
     - Callbacks : `onProgress` → `progress.report()`, `isCancelled` → `token.isCancellationRequested`, `createUri` → `vscode.Uri.file()`
  3. Message de résumé final :
     - Succès : `"X fichiers formatés, Y ignorés"`
     - Avec erreurs : `"X formatés, Y ignorés, Z erreurs"` + bouton "Show Errors"
     - Annulé : `"Annulé. X fichiers formatés avant annulation."`

### 5. Tests — `test/unit/batch-formatter.test.ts`

Exporter les fonctions internes nécessaires pour les tests (via exports nommés).

Tests à écrire :
- **discoverFiles** : structure temp avec `.ts`, `.js`, `.css`, `node_modules/` → vérifie la bonne sélection
- **isFileInExcludedFolder** : chemins relatifs, slashes normalisés
- **createBatchConfig** : force-disable des features VS Code-dépendantes
- **formatSingleFile** : fichier normal → formatted, déjà trié → pas de changement, `// tidyjs-ignore` → skip, erreur de syntaxe → skip, fichier vide → skip
- **Idempotence** : formater 2 fois produit le même résultat

## Sécurité (garde-fous)

1. **Jamais de write si `output === input`**
2. **Skip si parse échoue** (fichiers avec erreurs de syntaxe)
3. **Validation post-format** : re-parse le résultat, skip si échoue
4. **Features VS Code-dépendantes désactivées** (`removeUnusedImports`, `removeMissingModules`, `pathResolution`)
5. **Dossiers dangereux toujours ignorés** (`node_modules`, `.git`, `dist`, etc.)
6. **Annulation possible** à tout moment via le bouton Cancel
7. **Traitement séquentiel** — pas de race conditions
8. **Dispose des parsers** dans le finally pour éviter les fuites mémoire

## Vérification

1. `tsc --noEmit` → pas d'erreurs de type
2. `npm run lint` → pas d'erreurs de lint
3. `npm run test` → tous les tests passent (existants + nouveaux)
4. Test manuel en debug (CMD+F5) :
   - Clic droit sur un dossier dans l'Explorer → "TidyJS: Format Folder" visible
   - Exécution sur un petit dossier → vérifier le résumé
   - Annulation pendant l'exécution → vérifie que ça s'arrête
   - Fichier avec `// tidyjs-ignore` → ignoré
   - Fichier dans `excludedFolders` → ignoré
