# Guide de Documentation TidyJS

Ce dossier rassemble les ressources pour comprendre et configurer l'extension VS Code **TidyJS**. Vous y trouverez les bases d'utilisation ainsi que des guides avancés pour tirer parti de toutes les fonctionnalités.

## Sommaire

-   [Présentation](#pr%C3%A9sentation)
-   [Installation](#installation)
-   [Prise en main](#prise-en-main)
-   [Configuration](#configuration)
-   [Dépannage](#d%C3%A9pannage)
-   [Ressources complémentaires](#ressources-compl%C3%A9mentaires)

## Présentation

TidyJS formate automatiquement les déclarations d'import dans vos fichiers JavaScript et TypeScript. L'extension regroupe les imports par catégories, aligne les mots-clés `from` et supprime les imports inutilisés en option.

## Installation

1. Ouvrez VS Code.
2. Recherchez "TidyJS" dans la marketplace des extensions.
3. Cliquez sur **Installer**.

## Prise en main

-   Lancez la commande **TidyJS: Format Imports** depuis la palette de commandes (`Ctrl+Shift+P` ou `Cmd+Shift+P`).
-   Activez le formatage automatique à l'enregistrement en ajoutant à vos paramètres :

```json
{
    "tidyjs.format.onSave": true
}
```

## Configuration

Les principaux réglages sont décrits ci-dessous :

-   **`tidyjs.groups`** : définition des groupes d'import. Consultez le fichier [groups-configuration.md](./groups-configuration.md) pour un guide détaillé.
-   **`tidyjs.importOrder`** : ordre des types d'import (par défaut, named, sideEffect, etc.).
-   **`tidyjs.format.removeUnusedImports`** : supprime les imports non utilisés lors du formatage.
-   **`tidyjs.excludedFolders`** : liste des dossiers à ignorer.

## Dépannage

Si le formatage ne se déclenche pas ou semble incorrect :

1. Activez le mode debug :
    ```json
    {
        "tidyjs.debug": true
    }
    ```
2. Ouvrez l'onglet **Output** de VS Code et sélectionnez **TidyJS** pour consulter les logs détaillés.
3. Vérifiez vos expressions régulières de groupes à l'aide d'un outil en ligne.

## Ressources complémentaires

-   [Guide des groupes](./groups-configuration.md)
-   [Règles de formatage](./rules.md)
-   [README principal](../README.md)
