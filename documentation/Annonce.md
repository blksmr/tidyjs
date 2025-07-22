# TidyJS 1.5.0 Bump Minor - Chemin dynamique 🚀

## Résolution automatique des chemins 🎯

**Fini la galère avec les imports relatifs !**

- ✅ Plus besoin de `../../../components` 
- ✅ Switch automatique entre chemins relatifs et alias (`@app/components`)
- ✅ Support TypeScript, Vite ET Webpack - détection automatique de votre config
- ✅ 2 modes au choix : `relative` ou `absolute`

## Support Vite boosté 💪

- ✨ Parser Vite ultra-intelligent qui trouve vos alias même dans des fichiers externes
- ✨ Support des configs complexes avec spread operators
- ✨ Détection auto des patterns monorepo (`@app`, `@core`, `@library`)

## Système d'ordre automatique ⚡

- 🎉 Plus besoin de gérer les numéros d'ordre manuellement
- 🎉 Conflits résolus automatiquement
- 🎉 Groupes sans ordre assignés automatiquement

## Bugs corrigés 🐛

- ✅ Fix du cache avec les RegExp
- ✅ Plus de popups debug intrusifs
- ✅ Meilleure gestion des commentaires multilignes

## Configuration

Pour activer la résolution de chemins :

```json
{
  "tidyjs.pathResolution.enabled": true
}
```

---
# TidyJS 1.5.1 - Configurations multiples 🚀

## C'est quoi ? 🤔

**Fini la config unique pour tout le projet !**

- ✨ Fichiers `tidyjs.json` ou `.tidyjsrc` dans n'importe quel dossier
- ✨ Chaque partie du code peut avoir ses propres règles d'organisation
- ✨ Configuration hiérarchique intelligente

## Comment ça marche ? 🔧

**Priorité de recherche :**
1. Fichier local (`.tidyjsrc` > `tidyjs.json`)
2. Dossiers parents (remontée automatique)
3. Settings VS Code workspace
4. Settings VS Code globaux
5. Configuration par défaut

**Héritage avec `extends` :**
```json
{
  "extends": "../base.json",
  "groups": [
    { "name": "Custom", "match": "^custom" }
  ]
}
```

## Cas d'usage concrets 💡

### Structure projet
```
projet/
├── src/
│   ├── .tidyjsrc          # React, indent 4
│   └── components/
└── scripts/
    └── .tidyjsrc          # Node.js, indent 2
```

### Exemple de configs
```json
// src/.tidyjsrc - Config React
{
  "groups": [
    { "name": "React", "match": "^react", "order": 1 },
    { "name": "Components", "match": "^@/components", "order": 2 }
  ],
  "format": { "indent": 4 }
}
```

```json
// scripts/.tidyjsrc - Config Node.js
{
  "groups": [
    { "name": "Node", "match": "^(fs|path|util)", "order": 1 },
    { "name": "External", "match": "^[^@./]", "order": 2 }
  ],
  "format": { "indent": 2 }
}
```

## Avantages ✨

- 🎯 **Équipes spécialisées** : Front-end vs Back-end peuvent avoir leurs propres règles
- 🔄 **Code legacy** : Garde son formatage spécifique sans impact
- 🏗️ **Monorepos** : Chaque package a sa configuration optimale

## Bonus ⚡

- 🔥 Hot reload automatique lors des modifications
- 📝 Schéma JSON pour l'autocomplétion VS Code
- 🔒 Zero breaking change - rétrocompatible à 100%

**Parfait pour les monorepos et les gros projets avec plusieurs équipes !**
---
# Fix 1.5.2
Bug fix typescript manquant au build.