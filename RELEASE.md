# Guide de Release TidyJS

## 🚀 Workflow de développement et release

### 1. Développement quotidien

```bash
# Lancer le mode développement (watch)
npm run dev

# Vérifier la qualité du code
npm run check        # Lance types + lint + tests
npm run test:watch   # Tests en mode watch
npm run lint:fix     # Corriger les erreurs de lint auto
```

### 2. Avant de commit

```bash
# Vérification complète
npm run check
```

### 3. Release d'une nouvelle version

#### Pour un patch (bug fix) - 1.3.5 → 1.3.6
```bash
npm run release:patch
```

#### Pour une version mineure (nouvelles fonctionnalités) - 1.3.5 → 1.4.0
```bash
npm run release:minor
```

#### Pour une version majeure (breaking changes) - 1.3.5 → 2.0.0
```bash
npm run release:major
```

Ces commandes vont automatiquement :
1. ✅ Vérifier les types TypeScript
2. ✅ Lancer ESLint
3. ✅ Exécuter tous les tests
4. 📝 Mettre à jour le numéro de version dans package.json et CHANGELOG.md
5. 📦 Créer le fichier .vsix pour la publication

### 4. Publication sur VS Code Marketplace

Après la release, publier l'extension :
```bash
vsce publish
```

Ou publier directement via l'interface web : https://marketplace.visualstudio.com/manage

## 📋 Scripts disponibles

### Développement
- `npm run dev` - Mode watch pour le développement
- `npm run compile` - Compilation simple

### Qualité
- `npm run check` - Vérification complète (types + lint + tests)
- `npm run test` - Tests unitaires
- `npm run test:watch` - Tests en mode watch
- `npm run test:coverage` - Tests avec coverage
- `npm run lint` - Vérification ESLint
- `npm run lint:fix` - Correction automatique ESLint

### Release
- `npm run release:patch` - Release version patch
- `npm run release:minor` - Release version mineure
- `npm run release:major` - Release version majeure
- `npm run build` - Construction manuelle du .vsix

## 🔧 Dépannage

Si la commande `vsce` n'est pas disponible :
```bash
npm install -g @vscode/vsce
```

Si vous avez des problèmes de permissions :
```bash
sudo npm install -g @vscode/vsce
```