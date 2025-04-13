# Refactoring App Modules Pattern

## Contexte
Actuellement dans `src/utils/config.ts`, la fonction `getGroups()` utilise une vérification hardcodée `.startsWith('@app')` pour identifier les modules d'application. Cette approche manque de flexibilité car le pattern des modules d'application est déjà géré via `patterns.appModules` dans la configuration.

## Problème
1. Utilisation hardcodée de '@app' au lieu d'utiliser le pattern configuré
2. Manque de flexibilité pour supporter d'autres préfixes de modules
3. Incohérence entre la configuration et l'implémentation

## Solution Proposée

### 1. Modification de getGroups()
```typescript
const appModulePattern = this.config.patterns?.appModules;
// ...
const aIsApp = appModulePattern?.test(a.name) ?? false;
const bIsApp = appModulePattern?.test(b.name) ?? false;
// ...
if (aIsApp && bIsApp) {
    if (a.name === appModulePattern.source) return 1;
    if (b.name === appModulePattern.source) return -1;
    return a.name.localeCompare(b.name);
}
```

### 2. Tests
- Vérifier que les imports de `app-subfolders.tsx` sont toujours correctement triés
- Ajouter des cas de test avec différents patterns de modules

### 3. Documentation
- Mettre à jour les commentaires de la fonction getGroups()
- Expliquer la logique de tri dans la documentation

## Impact
1. Meilleure cohérence avec la configuration
2. Support de patterns personnalisés pour les modules d'application
3. Maintenance plus facile

## Étapes suivantes
1. Implémenter les modifications en mode Code
2. Exécuter et mettre à jour les tests
3. Valider le comportement avec différents patterns