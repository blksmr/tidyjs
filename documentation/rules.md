# Règles de formatage des imports

## 1. Responsabilités du Formatter

Le formatter est responsable de l'alignement et du formatage final des imports après que le parser les ait organisés et transmis dans un format valide et simple.

### Alignement précis
- Dans chaque groupe, tous les mots-clés `from` doivent être alignés sur la même colonne
- L'espacement entre la fin de la partie import et le mot-clé `from` est réalisé avec des espaces
- L'alignement doit s'adapter à l'import le plus long de chaque groupe individuel
- Lorsqu'un import a plusieurs éléments nommés, l'accolade fermante doit être alignée avec les autres identifiants d'import
- Le calcul exact de l'alignement doit prendre en compte tous les caractères, y compris les accolades et les espaces

### Gestion des imports multi-lignes
- Les imports avec plusieurs éléments nommés sur plusieurs lignes doivent être formatés avec :
  - Une accolade ouvrante sur la première ligne
  - Les imports nommés triés par longueur du plus court au plus long, un par ligne
  - L'accolade fermante sur une ligne séparée, alignée avec les autres identifiants d'import
  - Les espaces nécessaires pour aligner le mot-clé `from` avec les autres imports du groupe

### Optimisation des groupements d'imports
- Les imports nommés provenant du même module doivent être regroupés/fusionnées dans un seul statement
- Dans ces regroupements, les imports doivent être triés par la source `chemin` alphabétiquement
- Les regroupements d'imports doivent suivre le format multi-lignes si le nombre d'imports est supérieur à 1

In-fine le parser fournit une structure d'imports hautement organisée et cohérente, puis le formatter s'occupe de l'alignement visuel qui rend le code plus lisible.

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
2. L'ordre des types selon la configuration :
   - default (import par défaut)
   - named (import nommé)
   - typeDefault (import de type par défaut)
   - typeNamed (import de type nommé)
   - sideEffect (import d'effet de bord)

### 2.3 Nettoyage et organisation
- Suppression des commentaires simples (lignes commençant par //)
- Conservation des commentaires de groupe (// GroupName)
- Dédoublonnage des commentaires de groupe
- Suppression des lignes vides consécutives (maximum une ligne vide entre les groupes)
- Ajout de deux lignes vides à la fin de la section des imports

### 2.4 Gestion des commentaires et des cas spéciaux
- Les commentaires multilignes (/* */) sont ignorés lors du formatage
- Les imports dynamiques (import() ou await import) ne sont pas supportés dans la section des imports statiques
- Les imports doivent être placés au début du fichier, avant tout autre code
- Les lignes export sont ignorées lors de la détection de la plage des imports
- Les commentaires de groupe (// GroupName) sont préservés mais dédoublonnés

### 2.5 Gestion des imports multi-lignes
- Pour les imports multi-lignes, le calcul de l'alignement prend en compte :
  - La longueur maximale des imports individuels
  - L'indentation de 4 espaces pour chaque import
  - Un espace supplémentaire si ce n'est pas le dernier import
- L'accolade fermante est placée sur une nouvelle ligne
- L'alignement du mot-clé `from` est calculé en fonction de la position de l'accolade fermante

### 2.6 Déduplication et optimisation
- Les imports en double sont détectés et fusionnés via une fonction de hachage efficace
- La clé de hachage est composée du type d'import, de la source et des spécifiers triés
- Les imports sont mis en cache pour optimiser les performances
- Les imports du même type et de la même source sont regroupés

### 2.7 Détection de la plage des imports
- Les imports doivent être consécutifs au début du fichier
- La détection commence à la première ligne d'import et s'arrête au premier code non-import
- Les commentaires et lignes vides précédant le premier import sont inclus
- Les lignes vides suivant le dernier import sont incluses jusqu'au prochain code
- Gestion spéciale des imports multi-lignes avec accolades
- Les lignes export sont ignorées lors de la détection
- En cas de mélange d'imports statiques et dynamiques, la détection échoue

### 2.8 Validation et erreurs
- Détection des imports dynamiques parmi les imports statiques
- Vérification de la présence de code non-import dans la section des imports
- Gestion des erreurs de formatage avec retour du texte source original en cas d'échec

## 3. Exemples de formatage

### 3.1 Exemple 1

Input:
```TS
import type { Test } from 'test';
import { useState }  from 'react';
import type Test from 'test';

import { YpButton }  from 'ds';

import React  from 'react';
```

Expected output:
```TS
// Misc
import React         from 'react';
import { useState }  from 'react';
import type Test     from 'test';
import type { Test } from 'test';

// DS
import { YpButton } from 'ds';
```

### 3.2 Exemple 2

Pre-formatage:
```TS
// @app/dossier
import AbsenceInitFormComponent from '@app/dossier/components/absences/init/AbsenceInitFormComponent';
import { useClientNotification } from '@app/notification/ClientNotificationProvider';
import AccordFormComponent from '@app/dossier/components/britania/init/AbsenceInitFormComponent';
import useUtilisateurSearch from '@app/client/providers/parametrage/utilisateurs/UtilisateurSearchProvider';
import AbsencesFormComponent from '@app/dossier/components/absences/init/AbsencesFormComponent';
```

Post-formatage:
```TS
// @app/client
import useUtilisateurSearch  from '@app/client/providers/parametrage/utilisateurs/UtilisateurSearchProvider';

// @app/dossier
import AbsenceInitFormComponent  from '@app/dossier/components/absences/init/AbsenceInitFormComponent';
import AbsencesFormComponent     from '@app/dossier/components/absences/init/AbsencesFormComponent';
import AccordFormComponent       from '@app/dossier/components/britania/init/AbsenceInitFormComponent';

// @app/notification
import { useClientNotification }  from '@app/notification/ClientNotificationProvider';
```

### 3.3 Les noms d'imports multiples comme ici avec `react`et `date-fns` etc. Doivent être ordonner par longueur du plus court au plus long.

```TS
// Misc
import {
    useRef,
    useMemo,
    useState,
    Fragment,
    useEffect,
    useCallback,
    FragmentUse,
}                      from 'react';
import cn              from 'classnames';
import {
    format,
    getWeek,
    subWeeks,
    addWeeks,
    parseISO,
    endOfDay,
    isBefore,
    isWeekend,
    isSameDay,
    startOfDay,
    startOfMonth,
    lastDayOfWeek,
    lastDayOfMonth,
    differenceInDays,
    isWithinInterval,
    eachDayOfInterval,
    eachWeekOfInterval
}                      from 'date-fns';
import { fr }          from 'date-fns/locale';
