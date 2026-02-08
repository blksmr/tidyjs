# Plan: Refactoring PathResolver — Suppression des loaders fragiles

## Contexte

Le système `UnifiedConfigLoader` (`src/utils/config-loaders.ts`) tente de parser les fichiers de config de 3 bundlers pour extraire les alias de chemins :
- **tsConfigLoader** (l.14-46) : parse `tsconfig.json` / `jsconfig.json` — format JSON stable, ne change jamais
- **viteConfigLoader** (l.51-266) : **215 lignes** de parsing regex de JS arbitraire avec fallbacks hardcodés (`@app`, `@core`, `@library`, `@shared`, `@common`) — fondamentalement fragile
- **webpackConfigLoader** (l.271-302) : même approche regex sur JS — fragile

**Problème** : parser du JavaScript/TypeScript par regex est non-fiable (configs dynamiques, imports, fonctions, variables). Ça casse entre versions d'outils et ne couvre pas les patterns non-standard.

**Solution** : garder uniquement tsconfig (format stable), ajouter des aliases déclaratifs dans `.tidyjsrc`, supprimer tout le reste.

---

## Étape 1 : Types — ajouter `aliases` à `pathResolution`

**`src/types.ts`** — ajouter `aliases` aux deux interfaces :

```typescript
// Config (l.38-42)
pathResolution?: {
    enabled?: boolean;
    mode?: 'relative' | 'absolute';
    preferredAliases?: string[];
    aliases?: Record<string, string[]>;  // { "@app/*": ["./src/app/*"] }
};

// TidyJSConfigFile (l.85-89) — idem
```

---

## Étape 2 : Schema + package.json

**`tidyjs.schema.json`** — ajouter dans `pathResolution.properties` :
```json
"aliases": {
    "type": "object",
    "description": "Path aliases au format tsconfig paths. Clés = patterns (ex: '@app/*'), valeurs = tableaux de chemins relatifs (ex: ['./src/app/*'])",
    "additionalProperties": {
        "type": "array",
        "items": { "type": "string" }
    }
}
```

**`package.json`** — ajouter après `tidyjs.pathResolution.preferredAliases` (l.225) :
```json
"tidyjs.pathResolution.aliases": {
    "type": "object",
    "default": {},
    "description": "Custom path aliases (tsconfig paths format). Override auto-detected tsconfig paths.",
    "additionalProperties": {
        "type": "array",
        "items": { "type": "string" }
    }
}
```

---

## Étape 3 : Config loading — passer les aliases

**`src/utils/config.ts`** (l.521) — lire le nouveau setting VS Code :
```typescript
const customAliases = vsConfig.get<Record<string, string[]>>('pathResolution.aliases');
if (customAliases !== undefined && Object.keys(customAliases).length > 0) {
    config.pathResolution = config.pathResolution || {};
    config.pathResolution.aliases = customAliases;
}
```
Note : les chemins sont résolus en absolu plus tard dans PathResolver, pas ici.

**`src/utils/configLoader.ts`** — `convertFileConfigToConfig()` (l.155-157) passe déjà `fileConfig.pathResolution` tel quel → les aliases de `.tidyjsrc` passent automatiquement. Mais il faut résoudre les chemins relatifs en absolu.

Modifier la signature pour recevoir `configPath` :
```typescript
// l.112 : ajouter configPath
static convertFileConfigToConfig(fileConfig: TidyJSConfigFile, configPath: string): Partial<Config>

// l.155-157 : résoudre les aliases
if (fileConfig.pathResolution) {
    config.pathResolution = { ...fileConfig.pathResolution };
    if (fileConfig.pathResolution.aliases) {
        const configDir = path.dirname(configPath);
        config.pathResolution.aliases = Object.fromEntries(
            Object.entries(fileConfig.pathResolution.aliases).map(([pattern, paths]) => [
                pattern,
                paths.map(p => path.resolve(configDir, p))
            ])
        );
    }
}

// l.182 : passer configPath à l'appel
const config = this.convertFileConfigToConfig(fileConfig, configPath);
```

---

## Étape 4 : Refactorer `path-resolver.ts` (changement principal)

### 4a. Supprimer l'import de `UnifiedConfigLoader`
Remplacer `import { UnifiedConfigLoader } from './config-loaders'` par les imports nécessaires.

### 4b. Inliner la logique tsconfig (~30 lignes)
Déplacer `extractTsConfigPaths()` (actuellement `tsConfigLoader.extractAliases` dans config-loaders.ts l.18-45) comme fonction standalone dans path-resolver.ts. Exporter pour les tests.

### 4c. Ajouter `loadTsConfigMappings()` (logique de recherche de fichier)
Reprend la logique de `UnifiedConfigLoader.loadAliases()` (walk up + readFile + JSON parse) mais uniquement pour tsconfig/jsconfig :

```typescript
async function loadTsConfigMappings(document: TextDocument): Promise<PathMapping[]> {
    const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) { return []; }

    let currentUri = Uri.joinPath(document.uri, '..');
    const rootUri = workspaceFolder.uri;

    while (currentUri.fsPath.startsWith(rootUri.fsPath)) {
        for (const name of ['tsconfig.json', 'jsconfig.json']) {
            const configUri = Uri.joinPath(currentUri, name);
            try {
                const bytes = await workspace.fs.readFile(configUri);
                const content = Buffer.from(bytes).toString('utf-8');
                const json = JSON.parse(
                    content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').replace(/,(\s*[}\]])/g, '$1')
                );
                const mappings = extractTsConfigPaths(configUri.fsPath, json);
                if (mappings.length > 0) { return mappings; }
            } catch { /* fichier absent ou JSON invalide */ }
        }
        const parent = Uri.joinPath(currentUri, '..');
        if (parent.fsPath === currentUri.fsPath) { break; }
        currentUri = parent;
    }
    return [];
}
```

### 4d. Modifier `PathResolverConfig`
```typescript
export interface PathResolverConfig {
    mode: 'relative' | 'absolute';
    preferredAliases?: string[];
    aliases?: Record<string, string[]>;  // depuis .tidyjsrc (déjà résolus en absolu)
}
```

### 4e. Réécrire `loadPathMappings()`
- Priorité 1 : aliases de `.tidyjsrc` / VS Code settings (`this.config.aliases`)
- Priorité 2 : tsconfig/jsconfig auto-détecté
- Dedup par pattern (`.tidyjsrc` gagne)
- Simplifier le cache : `Map<string, PathMapping[]>` (supprimer `configType`)

```typescript
private async loadPathMappings(document: TextDocument): Promise<PathMapping[]> {
    const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) { return []; }

    const cacheKey = workspaceFolder.uri.toString();
    const cached = this.configCache.get(cacheKey);
    if (cached) { return [...cached]; }

    const allMappings: PathMapping[] = [];

    // 1. .tidyjsrc aliases (priorité haute)
    if (this.config.aliases) {
        for (const [pattern, paths] of Object.entries(this.config.aliases)) {
            allMappings.push({ pattern, paths });
        }
    }

    // 2. tsconfig.json / jsconfig.json (priorité basse)
    try {
        const tsMappings = await loadTsConfigMappings(document);
        const existing = new Set(allMappings.map(m => m.pattern));
        for (const m of tsMappings) {
            if (!existing.has(m.pattern)) { allMappings.push(m); }
        }
    } catch (error) {
        logError('Error loading tsconfig paths:', error);
    }

    const sorted = [...allMappings].sort((a, b) =>
        patternSpecificity(b.pattern) - patternSpecificity(a.pattern)
    );

    this.configCache.set(cacheKey, sorted);
    return [...sorted];
}
```

### 4f. Supprimer `getConfigInfo()`
Pas d'appelant externe, et `configType` n'existe plus.

### 4g. Supprimer `private unifiedLoader`
Plus nécessaire.

---

## Étape 5 : Mettre à jour `extension.ts`

**`src/extension.ts`** (l.211-214) — passer les aliases :
```typescript
const pathResolver = new PathResolver({
    mode: currentConfig.pathResolution.mode || 'relative',
    preferredAliases: currentConfig.pathResolution.preferredAliases || [],
    aliases: currentConfig.pathResolution.aliases,
});
```

---

## Étape 6 : Supprimer les fichiers morts

- **`src/utils/config-loaders.ts`** — tout le fichier (404 lignes). La logique tsconfig est inlinée dans path-resolver.ts.
- **`src/utils/vite-alias-detector.ts`** — dead code, importé nulle part.

---

## Étape 7 : Mettre à jour les tests

**`test/configLoader/baseUrl-support.test.ts`** — changer l'import :
```typescript
// Avant
import { tsConfigLoader } from '../../src/utils/config-loaders';
// Après
import { extractTsConfigPaths } from '../../src/utils/path-resolver';
```
Adapter les appels : `tsConfigLoader.extractAliases(...)` → `extractTsConfigPaths(...)`. Même signature, changements minimaux.

**Ajouter des tests** dans `test/path-resolver/` :
- `.tidyjsrc` aliases produisent les bons `PathMapping[]`
- `.tidyjsrc` aliases ont priorité sur tsconfig pour le même pattern
- tsconfig paths utilisés quand pas de `.tidyjsrc` aliases
- Les deux sources fusionnent correctement

---

## Étape 8 : Vérification

```bash
npm run check   # tsc --noEmit && eslint && jest (605+ tests)
```

---

## Résumé des fichiers

| Fichier | Action |
|---------|--------|
| `src/types.ts` | Ajouter `aliases` à pathResolution |
| `tidyjs.schema.json` | Ajouter propriété `aliases` |
| `package.json` | Ajouter setting `pathResolution.aliases` |
| `src/utils/config.ts` | Lire le setting `aliases` |
| `src/utils/configLoader.ts` | Résoudre les chemins relatifs des aliases |
| `src/utils/path-resolver.ts` | Inliner tsconfig, supprimer UnifiedConfigLoader, réécrire loadPathMappings |
| `src/extension.ts` | Passer `aliases` au PathResolver |
| `src/utils/config-loaders.ts` | **SUPPRIMER** |
| `src/utils/vite-alias-detector.ts` | **SUPPRIMER** |
| `test/configLoader/baseUrl-support.test.ts` | Adapter l'import |
| `test/path-resolver/aliases.test.ts` | **NOUVEAU** — tests des aliases .tidyjsrc |
