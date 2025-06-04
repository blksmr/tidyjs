# Règles de formatage et de traitement des imports

## 1. Responsabilités du Parser

Le parser analyse le code source et sépare intelligemment les imports mixtes en imports distincts selon leur type.

### Séparation intelligente des imports mixtes

Le parser identifie et sépare automatiquement tous les types d'imports mixtes :

```typescript
// Input
import React, { useState, type FC } from 'react';

// Parser Output (3 imports séparés)
1. Default: import React from 'react';
2. Named: import { useState } from 'react';  
3. Type Named: import type { FC } from 'react';
```

### Types d'imports supportés

| Type | Code interne | Exemple | Description |
|------|--------------|---------|-------------|
| Side Effect | `sideEffect` | `import './styles.css';` | Imports avec effets de bord |
| Default | `default` | `import React from 'react';` | Imports par défaut |
| Named | `named` | `import { useState } from 'react';` | Imports nommés |
| Namespace | `default` | `import * as Utils from './utils';` | Imports namespace (traités comme default) |
| Type Default | `typeDefault` | `import type React from 'react';` | Imports de type par défaut |
| Type Named | `typeNamed` | `import type { FC } from 'react';` | Imports de type nommés |
| Type Namespace | `typeDefault` | `import type * as Types from './types';` | Imports de type namespace |

### Gestion des imports mixtes

Le parser gère automatiquement toutes les combinaisons d'imports mixtes :

- **Default + Named** : `import React, { useState } from 'react';` → 2 imports
- **Default + Namespace** : `import React, * as Utils from 'react';` → 2 imports  
- **Named + Type Named** : `import { useState, type FC } from 'react';` → 2 imports
- **Default + Named + Type** : `import React, { useState, type FC } from 'react';` → 3 imports
- **Type Default + Type Named** : `import type React, { FC } from 'react';` → 2 imports
- Et toutes autres combinaisons...

### Consolidation intelligente

Après séparation, les imports du même type et de la même source sont consolidés :
- Les imports nommés de la même source sont fusionnés
- Les imports de type nommés de la même source sont fusionnés
- Les spécifiers sont dédupliqués et triés alphabétiquement

## 2. Responsabilités du Formatter

Le formatter est responsable de l'alignement et du formatage final des imports après que le parser les ait organisés.

### Alignement précis

-   Dans chaque groupe, tous les mots-clés `from` doivent être alignés sur la même colonne
-   L'espacement entre la fin de la partie import et le mot-clé `from` est réalisé avec des espaces
-   L'alignement doit s'adapter à l'import le plus long de chaque groupe individuel
-   Le calcul exact de l'alignement prend en compte la position idéale du mot-clé `from` pour chaque import

### Gestion des imports multi-lignes

-   Les imports avec plusieurs éléments nommés sur plusieurs lignes sont formatés avec :
    -   Une accolade ouvrante sur la première ligne
    -   Chaque import sur une ligne séparée avec une indentation de 4 espaces
    -   Pour les imports nommés ou de type nommé uniquement, les éléments sont triés par longueur du plus court au plus long
    -   L'accolade fermante alignée avec la position calculée pour le mot-clé `from`

## 3. Ordre et Priorité des Imports

### 3.1 Ordre de priorité

L'ordre des imports est déterminé par :

1. **React Priority** : Les imports React apparaissent toujours en premier dans leur groupe
2. **Imports prioritaires** : Définis par la configuration de groupe (propriété `priority`)
3. **Ordre des types** : Configuré via `importOrder` (défaut ci-dessous)
4. **Ordre alphabétique** : Au sein de chaque type

### 3.2 Configuration de l'ordre des types

```typescript
{
  "sideEffect": 0,    // import './styles.css';
  "default": 1,       // import React from 'react';
  "named": 2,         // import { useState } from 'react';
  "typeOnly": 3       // import type { FC } from 'react';
}
```

**Note importante** : La propriété `typeOnly` dans la configuration couvre à la fois :
- `typeDefault` : `import type React from 'react';`
- `typeNamed` : `import type { FC } from 'react';`

## 4. Formatage et Nettoyage

### 4.1 Nettoyage et organisation

-   Conservation uniquement de la première occurrence d'un commentaire de groupe
-   Suppression des commentaires simples (non-groupe)
-   Maximum une ligne vide entre les groupes
-   Ajout systématique de deux lignes vides à la fin de la section des imports
-   Suppression des lignes vides en fin de section avant d'ajouter les deux lignes vides finales

### 4.2 Gestion des commentaires et cas spéciaux

-   Les commentaires multilignes (`/* */`) sont ignorés et exclus du résultat final
-   Les imports dynamiques sont détectés par deux patterns :
    -   `import(` ou `await import` dans la section d'imports
    -   `(?:await\s+)?import\s*\(` pour la détection de la plage d'imports
-   Les lignes export sont ignorées lors de la détection de la plage des imports

### 4.3 Algorithme d'alignement

Pour chaque groupe d'imports :

1. **Analyse préliminaire** en une passe :
    - Détection des imports multilignes
    - Calcul de la position idéale du mot-clé `from` pour chaque import
    - Pour les imports multilignes, prise en compte de la longueur maximale des imports
2. **Détermination** de la position globale maximale du mot-clé `from`
3. **Application** de l'alignement en une seule passe finale

## 5. Optimisations et Performance

### 5.1 Optimisations du Parser

-   **Cache intelligent** : Système de cache avec support RegExp pour les configurations
-   **Séparation efficace** : Analyse AST en une seule passe pour identifier tous les types d'imports
-   **Consolidation optimisée** : Regroupement des imports du même type en O(n) 
-   **Déduplication** : Utilisation de Set et Map pour éviter les doublons

### 5.2 Optimisations du Formatter

-   **Alignement optimisé** : Calcul de l'alignement en deux passes seulement
-   **Gestion mémoire** : Optimisation des chaînes de caractères avec array join
-   **Cache des positions** : Évite les recalculs de positions d'alignement

### 5.3 Détection de la plage des imports

-   Les imports doivent être consécutifs au début du fichier
-   Inclusion des commentaires et lignes vides précédant le premier import
-   Inclusion des lignes vides suivant le dernier import jusqu'au prochain code
-   Détection des imports multilignes avec gestion des accolades
-   Rejet en cas de mélange d'imports statiques et dynamiques
-   Les lignes export sont ignorées lors de la détection

## 6. Gestion des Erreurs et Robustesse

### 6.1 Récupération d'erreurs

-   **Parser** : Gestion des erreurs de syntaxe avec récupération gracieuse
-   **Formatter** : Retour du texte source original en cas d'erreur
-   **Validation** : Vérification de la configuration avec messages détaillés
-   **Logging** : Messages d'erreur spécifiques sans interruption UI

### 6.2 Messages d'erreur

-   Messages contextuels pour les erreurs de parsing
-   Validation de la présence du résultat du parser
-   Messages d'erreur spécifiques pour les imports dynamiques
-   Logging en français pour les erreurs internes, anglais pour l'utilisateur

## 7. Corrections et Améliorations Récentes

### 7.1 Bugs corrigés

✅ **Séparation des imports mixtes** : Les imports comme `import { useState, type FC } from 'react'` sont maintenant correctement séparés  
✅ **Cache RegExp** : Correction du bug de sérialisation des expressions régulières dans le cache  
✅ **Validation des doublons** : Correction de la détection des ordres et noms de groupes dupliqués  
✅ **Logging non-intrusif** : Les messages debug n'interrompent plus l'utilisateur  
✅ **Support namespace** : Gestion correcte des imports namespace mixtes  

### 7.2 Nouvelles fonctionnalités

🚀 **Support complet des types TypeScript** : Tous les types d'imports TypeScript sont supportés  
🚀 **Séparation intelligente** : Détection automatique et séparation de tous les types d'imports mixtes  
🚀 **Cache performant** : Système de cache optimisé avec support RegExp  
🚀 **Validation robuste** : Détection et correction des configurations invalides
