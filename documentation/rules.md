# Règles de formatage des imports

## 1. Responsabilités du Formatter

Le formatter est responsable de l'alignement et du formatage final des imports après que le parser les ait organisés et transmis dans un format valide et simple.

### Alignement précis
- Dans chaque groupe, tous les mots-clés `from` doivent être alignés sur la même colonne
- L'espacement entre la fin de la partie import et le mot-clé `from` est réalisé avec des espaces
- L'alignement doit s'adapter à l'import le plus long de chaque groupe individuel
- Le calcul exact de l'alignement prend en compte la position idéale du mot-clé `from` pour chaque import

### Gestion des imports multi-lignes
- Les imports avec plusieurs éléments nommés sur plusieurs lignes sont formatés avec :
  - Une accolade ouvrante sur la première ligne
  - Chaque import sur une ligne séparée avec une indentation de 4 espaces
  - Pour les imports nommés ou de type nommé uniquement, les éléments sont triés par longueur du plus court au plus long
  - L'accolade fermante alignée avec la position calculée pour le mot-clé `from`

### Optimisation des groupements d'imports
- Les imports du même type et de la même source sont regroupés
- Les imports en double sont dédupliqués via un système de cache de clés
- Les imports sont triés par source dans chaque type d'import

## 2. Règles de Traitement des Imports

### 2.1 Types d'imports supportés
- Import par défaut :         `import React from 'react';`
- Import nommé :              `import { useState } from 'react';`
- Import de type par défaut : `import type Test from 'test';`
- Import de type nommé :      `import type { Test } from 'test';`
- Import d'effet de bord :    `import 'styles.css';`

### 2.2 Ordre de priorité
L'ordre des imports est déterminé par :
1. Les imports prioritaires (définis par configuration)
2. Les imports non prioritaires selon l'ordre des types configuré :
   ```typescript
   {
     'default': 0,
     'named': 1,
     'typeDefault': 2,
     'typeNamed': 3,
     'sideEffect': 4
   }
   ```
   Cet ordre peut être personnalisé via la configuration.

### 2.3 Nettoyage et organisation
- Conservation uniquement de la première occurrence d'un commentaire de groupe
- Suppression des commentaires simples (non-groupe)
- Maximum une ligne vide entre les groupes
- Ajout systématique de deux lignes vides à la fin de la section des imports
- Suppression des lignes vides en fin de section avant d'ajouter les deux lignes vides finales

### 2.4 Gestion des commentaires et des cas spéciaux
- Les commentaires multilignes (/* */) sont ignorés et exclus du résultat final
- Les imports dynamiques sont détectés par deux patterns :
  - `import(` ou `await import` dans la section d'imports
  - `(?:await\s+)?import\s*\(` pour la détection de la plage d'imports
- Les lignes export sont ignorées lors de la détection de la plage des imports

### 2.5 Algorithme d'alignement
Pour chaque groupe d'imports :
1. Analyse préliminaire en une passe :
   - Détection des imports multilignes
   - Calcul de la position idéale du mot-clé `from` pour chaque import
   - Pour les imports multilignes, prise en compte de la longueur maximale des imports
2. Détermination de la position globale maximale du mot-clé `from`
3. Application de l'alignement en une seule passe finale

### 2.6 Optimisation
- Utilisation de Set pour la déduplication des imports
- Cache des clés d'import pour éviter les recalculs
- Regroupement des imports en une seule passe
- Optimisation des chaînes de caractères avec array join
- Utilisation de Map pour le tri des imports

### 2.7 Détection de la plage des imports
- Les imports doivent être consécutifs au début du fichier
- Inclusion des commentaires et lignes vides précédant le premier import
- Inclusion des lignes vides suivant le dernier import jusqu'au prochain code
- Détection des imports multilignes avec gestion des accolades
- Rejet en cas de mélange d'imports statiques et dynamiques
- Les lignes export sont ignorées lors de la détection

### 2.8 Gestion des erreurs
- Retour du texte source original en cas d'erreur
- Logging des erreurs avec messages détaillés
- Validation de la présence du résultat du parser
- Messages d'erreur spécifiques pour les imports dynamiques