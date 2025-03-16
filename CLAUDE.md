# tidyimport - Commandes et style de code

## Commandes principales
- `npm run compile` : Vérifie les types, lint et build avec esbuild
- `npm run watch` : Mode développement, surveille les changements
- `npm run lint` : Lance ESLint sur les fichiers source
- `npm run lint:fix` : Lance ESLint avec autofix
- `npm run check-types` : Vérifie les types TypeScript
- `npm test` : Lance les tests
- `npm run build-prod` : Build production avec vérification des types et lint

## Style de code
- **Imports**: Organisés en groupes (Misc, DS, @app/dossier, @core, @library, Utils), mots-clés "from" alignés
- **Format**: Guillemets simples, point-virgule obligatoire, indentation de 4 espaces
- **Types**: Activation du mode strict TypeScript, préfixes "I" pour interfaces, "T" pour types
- **Nommage**: PascalCase pour classes/interfaces/composants, camelCase pour variables/méthodes 
- **Documentation**: Commentaires JSDoc pour fonctions complexes, commentaires de section pour les imports

## Bonnes pratiques
- Éviter l'utilisation de `any` (remplacer par types génériques ou unknown)
- Organiser les imports suivant l'ordre spécifié dans la documentation
- Utiliser les types TypeScript pour garantir la sécurité du code