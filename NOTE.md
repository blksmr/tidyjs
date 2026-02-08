Quelques features que j'ai en tête.

---                                                                                                                                              
1. sortSpecifiers — Trier les specifiers dans un import
                                                                                                                                                
// Avant                                                                                                                                       
import { useState, FC, useEffect, useCallback } from 'react';

// Après (par longueur)
import { FC, useState, useEffect, useCallback } from 'react';

Aujourd'hui les imports sont triés entre eux, mais les specifiers à l'intérieur d'un même import restent dans l'ordre d'origine.

---
2. maxLineWidth — Wrap automatique en multiline

// Avant — une ligne de 95 caractères
import { useState, useEffect, useCallback, useMemo, useRef, useContext } from 'react';

// Après (maxLineWidth: 80)
import {
    useState,
    useEffect,
    useCallback,
    useMemo,
    useRef,
    useContext,
} from 'react';

L'inverse serait utile aussi : replier un multiline en single-line quand ça tient sur une ligne.

---
3. trailingComma — Contrôler la virgule finale

// trailingComma: "always"
import {
    useState,
    useEffect,
} from 'react';

// trailingComma: "never"
import {
    useState,
    useEffect
} from 'react';

---
4. groupSeparator — Commentaires entre groupes

// groupSeparator: true
// React
import React from 'react';
import { useState } from 'react';

// Libraries
import { debounce } from 'lodash';

// Local
import { Button } from './components/Button';

Utilise le name de chaque groupe comme commentaire.

---
5. blankLinesBetweenGroups — Configurer l'espacement

// blankLinesBetweenGroups: 0 (compact)
import React from 'react';
import { debounce } from 'lodash';
import { Button } from './Button';

// blankLinesBetweenGroups: 2 (aéré)
import React from 'react';


import { debounce } from 'lodash';


import { Button } from './Button';

Actuellement c'est toujours 1.

---
6. CLI standalone

# Vérifier sans modifier (CI/CD)
npx tidyjs --check src/

# Formater en place
npx tidyjs --fix src/

Permettrait d'utiliser TidyJS hors VS Code, dans les pipelines CI ou avec d'autres éditeurs.

---
7. Diagnostics inline

Afficher des warnings VS Code directement dans l'éditeur :
- Import dupliqué (import { FC } from 'react' apparaît 2 fois)
- Import inutilisé (sans auto-fix, juste un soulignement)
- Import non trié (quick-fix "Organize with TidyJS")

---
8. enforceNewlineAfterImports — Ligne vide après le dernier import

// Avant (collé au code)
import { useState } from 'react';
const App = () => { ... };

// Après
import { useState } from 'react';

const App = () => { ... };

---
Les plus impactantes selon moi : 1, 2, 3 et 5. Le sortSpecifiers est la suite logique de ce qui existe, le maxLineWidth résout un vrai problème
quotidien. Qu'est-ce que tu en penses ?

---

MAJ 1.6.0

Changements interne                                                                                           
- Parser remplacé (oxc-parser au lieu de @typescript-eslint/parser)                                                                              
- Build system modernisé (CJS → ESM)                                                                                                             
- Bundle allégé (4 MB → 2.2 MB)  

Aucun changement visible pour l'utilisateur — même API, même config, même comportement. C'est un refactoring interne :                           

Nouvelles features :                                                                                                                             
  - sortDestructuring — tri des propriétés destructurées, interfaces, type literals, enums
  - sortClassProperties — tri des propriétés de classe                                                                                             
  - sortEnumMembers — tri des membres d'enum                                                      
  - sortExports — tri des spécificateurs d'export
  - organizeReExports — organisation des re-exports
  - Pragma // tidyjs-ignore pour ignorer le formatage
  - Commande Format Folder (formatage de dossier entier)
  - Code Action VS Code
  - Pipeline IR-based formatter (refactoring majeur)
  - Migration vers oxc-parser (refactoring interne)

5 nouvelles options de configuration, 2 nouvelles commandes, un refactoring d'architecture complet avec zéro breaking change.