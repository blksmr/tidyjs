import { writeFileSync } from 'fs';
import { parseImports, DEFAULT_CONFIG, ParserConfig } from '../index';
import path from 'path';

const config: ParserConfig = {
  importGroups: [
    { name: 'Misc', regex: /^(react|lodash|uuid)$/, order: 0, isDefault: true },
    { name: 'Composants', regex: /^@components/, order: 1 },
    { name: 'Utils', regex: /^@utils/, order: 2 },
  ],
  patterns: {
    ...DEFAULT_CONFIG.patterns,
    appSubfolderPattern: /@app\/([^/]+)/
  }
};

const sourceCode = `
import React from 'react';
import React as R from 'react';
import type Danger from 'danger';
import { Fragment, useCallback, type ChangeEvent } from 'react';
import type { ChangeEvent, FC } from 'react';
import {
    Fragment,
    useCallback,
    useEffect,
    type ChangeEvent,
    useMemo,
    useRef,
    useState
}                          from 'react';
import type {
    ChangeEvent,
    FC
}                          from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { navigate }        from '@reach/router';
import {
    createColumnHelper,
    getCoreRowModel,
    getFilteredRowModel,
    useReactTable
}                          from '@tanstack/react-table';
import type {
    Cell,
    ColumnDef
}                          from '@tanstack/react-table';
import cn                  from 'classnames';
import {
    addWeeks,
    differenceInDays,
    eachDayOfInterval,
    eachWeekOfInterval,
    endOfDay,
    format,
    getWeek,
    isBefore,
    isSameDay,
    isWeekend,
    isWithinInterval,
    lastDayOfMonth,
    lastDayOfWeek,
    parseISO,
    startOfDay,
    startOfMonth,
    subWeeks
}                          from 'date-fns';
import { fr }              from 'date-fns/locale';
import {
    filter,
    find,
    first,
    isEmpty,
    last,
    map,
    orderBy
}                          from 'lodash';
import { v4 as uuidv4 }    from 'uuid';
// DS (Alphabetical order + group DS + aligned from based on longest length name)
import {
    useYpModal,
    useYpStepper,
    useYpWrapperContext,
    YpAlert,
    YpButton,
    YpConfirmModal,
    YpDataTableTimeline,
    YpElement,
    YpFormModal,
    YpInput,
    YpPopover,
    YpSelect,
    YpSkeleton,
    YpStepperNew,
    YpTag,
    YpTooltip,
    YpTypography
}                        from 'ds';
// @app/client (group @app/client)
import useUtilisateurSearch  from '@app/client/providers/parametrage/utilisateurs/UtilisateurSearchProvider';
// @app/dossier (Alphabetical order + group @app/dossier + path subfolders alphabetical order order)
import AbsenceRapportComponent                        from '@app/dossier/components/absences/AbsenceRapportComponent';
import AbsenceDsnComponent                            from '@app/dossier/components/absences/dsn/AbsenceDsnComponent';
import AbsenceImportFormComponent                     from '@app/dossier/components/absences/import/AbsenceImportFormComponent';
import AbsenceInitFormComponent                       from '@app/dossier/components/absences/init/AbsenceInitFormComponent';
import AbsenceParamFormComponent                      from '@app/dossier/components/absences/param/AbsenceParamFormComponent';
import AbsenceRecapDetailComponent                    from '@app/dossier/components/absences/recap/AbsenceRecapDetailComponent';
import SalarieCellRenderer                            from '@app/dossier/components/salaries/SalarieCellRenderer';
import type RegroupementAbsenceModel                  from '@app/dossier/models/absences/RegroupementAbsenceModel';
import type DossierModel                              from '@app/dossier/models/DossierModel';
import { AbsenceFilterEnum }                          from '@app/dossier/models/enums/AbsenceFilterEnum';
import DsnAtStatut                                    from '@app/dossier/models/enums/DsnAtStatus';
import GenerationDsnStatutDepot                       from '@app/dossier/models/enums/GenerationDsnStatutDepot';
import ModeDemarrageAbsenceEnum                       from '@app/dossier/models/enums/ModeDemarrageAbsence';
import NatureEvenementAbsenceEnum                     from '@app/dossier/models/enums/NatureEvenementAbsence';
import RegroupementAbsenceStatutEnum                  from '@app/dossier/models/enums/RegroupementAbsenceStatut';
import StatutRegroupementAbsenceEnum                  from '@app/dossier/models/enums/StatutRegroupementAbsence';
import { StatutImportEnum }                           from '@app/dossier/models/RapportImportModel';
import type SalariesAbsencesListModel                 from '@app/dossier/models/SalariesAbsencesListModel';
import useAbsenceImport                               from '@app/dossier/providers/absences/import/AbsenceImportProvider';
import useRegroupementAbsenceDetail                   from '@app/dossier/providers/absences/RegroupementAbsenceDetailProvider';
import type { TRegroupementAbsenceAdditionals }       from '@app/dossier/providers/absences/RegroupementAbsenceDetailProvider';
import useRegroupementsAbsencesList                   from '@app/dossier/providers/absences/RegroupementsAbsencesListProvider';
import type { TRegroupementsAbsencesListAdditionals } from '@app/dossier/providers/absences/RegroupementsAbsencesListProvider';
import { useDossierContext }                          from '@app/dossier/providers/contexts/DossierContextProvider';
import useDsnAtActionsProvider                        from '@app/dossier/providers/dsn/DsnAtActionsProvider';
import useDsnAtListProvider                           from '@app/dossier/providers/dsn/DsnAtListProvider';
import useDsnAtResumeListProvider                     from '@app/dossier/providers/dsn/DsnAtResumeListProvider';
import useRapportImportDetail                         from '@app/dossier/providers/edp/RapportImportDetailProvider';
import useRapportImportLast                           from '@app/dossier/providers/edp/RapportImportLastProvider';
import useFichesHistorisationList                     from '@app/dossier/providers/fiches/FichesHistorisationListProvider';
import { moduleRoute as DossierModule }               from '@app/dossier/resources/common/Router';
// @app/notification (group @app/notification)
import { useClientNotification } from '@app/notification/ClientNotificationProvider';
// @core (Here from is aligned based on the whole group because of useUserContext length)
import type {
    TDataProviderReturn,
    WsDataModel
}                         from '@core/models/ProviderModel';
import { useUserContext } from '@core/providers/contexts/UserContextProvider';
import { getLocationId }  from '@core/utils/misc';
// @library (group @library)
import { getDateFormat }      from '@library/utils/dates';
import { useSearch }          from '@library/utils/search';
import { getPageStyleHeight } from '@library/utils/styles';
/*
*  Utils (group Utils)
*  Import nommée donc nous faisons ce raisonnement :
*  On parcour les noms des imports par longueur = getTextPreview.length : Ce qui ici nous donne 14 charactère
*  Nous avons ensuite 4 espace d'indentation
*  Sur la ligne on a donc 4 charactère (Parce que on as 3 espaces et une accolade de fermeture '}')
*  + 1 charactère d'espacement avant from (Toujours)
*  Ce qui nous donne 19 charactères avant "from 'yutils/text'".
*/
import { getPalette } from 'yutils/colors';
import {
    conjugate,
    getTextPreview
}                     from 'yutils/text';
`;

const sourceCode2 = `
// @app/dossier
import AbsenceInitFormComponent from '@app/dossier/components/absences/init/AbsenceInitFormComponent';
import AbsencesFormComponent    from '@app/dossier/components/absences/init/AbsencesFormComponent';
import AccordFormComponent      from '@app/dossier/components/britania/init/AbsenceInitFormComponent';

import { 
    AbsenceInitFormComponent, 
    BritaniaFormComponent,
    CaledoniaFormComponent
    DossierFormComponent,
    AbsencesFormComponent 
} from '@app/dossier/components/absences/init/AbsenceInitFormComponent';

// @app/alient
import useUtilisateurSearch from '@app/client/providers/parametrage/utilisateurs/UtilisateurSearchProvider';

// @app/notification
import { useClientNotification } from '@app/notification/ClientNotificationProvider';
`;

// Cas de test avec différents types d'erreurs
const problematicImports = `
import React from 'react';
import React as R from 'react';
import type Danger from 'danger';
import { Fragment, useCallback, type ChangeEvent } from 'react';
import type { ChangeEvent, FC } from 'react';
import {
    Fragment,
    useCallback,
    useEffect,
    type ChangeEvent,
    useMemo,
    useRef,
    useState
}                          from 'react';
import type {
    ChangeEvent,
    FC
}                          from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { navigate }        from '@reach/router';
import {
    createColumnHelper,
    getCoreRowModel,
    getFilteredRowModel,
    useReactTable
}                          from '@tanstack/react-table';
import type {
    Cell,
    ColumnDef
}                          from '@tanstack/react-table';
import cn                  from 'classnames';
import {
    addWeeks,
    differenceInDays,
    eachDayOfInterval,
    eachWeekOfInterval,
    endOfDay,
    format,
    getWeek,
    isBefore,
    isSameDay,
    isWeekend,
    isWithinInterval,
    lastDayOfMonth,
    lastDayOfWeek,
    parseISO,
    startOfDay,
    startOfMonth,
    subWeeks
}                          from 'date-fns';
import { fr }              from 'date-fns/locale';
import {
    filter,
    find,
    first,
    isEmpty,
    last,
    map,
    orderBy
}                          from 'lodash';
import { v4 as uuidv4 }    from 'uuid';
// DS (Alphabetical order + group DS + aligned from based on longest length name)
import {
    useYpModal,
    useYpStepper,
    useYpWrapperContext,
    YpAlert,
    YpButton,
    YpConfirmModal,
    YpDataTableTimeline,
    YpElement,
    YpFormModal,
    YpInput,
    YpPopover,
    YpSelect,
    YpSkeleton,
    YpStepperNew,
    YpTag,
    YpTooltip,
    YpTypography
}                        from 'ds';
// @app/client (group @app/client)
import useUtilisateurSearch  from '@app/client/providers/parametrage/utilisateurs/UtilisateurSearchProvider';
// @app/dossier (Alphabetical order + group @app/dossier + path subfolders alphabetical order order)
import AbsenceRapportComponent                        from '@app/dossier/components/absences/AbsenceRapportComponent';
import AbsenceDsnComponent                            from '@app/dossier/components/absences/dsn/AbsenceDsnComponent';
import AbsenceImportFormComponent                     from '@app/dossier/components/absences/import/AbsenceImportFormComponent';
import AbsenceInitFormComponent                       from '@app/dossier/components/absences/init/AbsenceInitFormComponent';
import AbsenceParamFormComponent                      from '@app/dossier/components/absences/param/AbsenceParamFormComponent';
import AbsenceRecapDetailComponent                    from '@app/dossier/components/absences/recap/AbsenceRecapDetailComponent';
import SalarieCellRenderer                            from '@app/dossier/components/salaries/SalarieCellRenderer';
import type RegroupementAbsenceModel                  from '@app/dossier/models/absences/RegroupementAbsenceModel';
import type DossierModel                              from '@app/dossier/models/DossierModel';
import { AbsenceFilterEnum }                          from '@app/dossier/models/enums/AbsenceFilterEnum';
import DsnAtStatut                                    from '@app/dossier/models/enums/DsnAtStatus';
import GenerationDsnStatutDepot                       from '@app/dossier/models/enums/GenerationDsnStatutDepot';
import ModeDemarrageAbsenceEnum                       from '@app/dossier/models/enums/ModeDemarrageAbsence';
import NatureEvenementAbsenceEnum                     from '@app/dossier/models/enums/NatureEvenementAbsence';
import RegroupementAbsenceStatutEnum                  from '@app/dossier/models/enums/RegroupementAbsenceStatut';
import StatutRegroupementAbsenceEnum                  from '@app/dossier/models/enums/StatutRegroupementAbsence';
import { StatutImportEnum }                           from '@app/dossier/models/RapportImportModel';
import type SalariesAbsencesListModel                 from '@app/dossier/models/SalariesAbsencesListModel';
import useAbsenceImport                               from '@app/dossier/providers/absences/import/AbsenceImportProvider';
import useRegroupementAbsenceDetail                   from '@app/dossier/providers/absences/RegroupementAbsenceDetailProvider';
import type { TRegroupementAbsenceAdditionals }       from '@app/dossier/providers/absences/RegroupementAbsenceDetailProvider';
import useRegroupementsAbsencesList                   from '@app/dossier/providers/absences/RegroupementsAbsencesListProvider';
import type { TRegroupementsAbsencesListAdditionals } from '@app/dossier/providers/absences/RegroupementsAbsencesListProvider';
import { useDossierContext }                          from '@app/dossier/providers/contexts/DossierContextProvider';
import useDsnAtActionsProvider                        from '@app/dossier/providers/dsn/DsnAtActionsProvider';
import useDsnAtListProvider                           from '@app/dossier/providers/dsn/DsnAtListProvider';
import useDsnAtResumeListProvider                     from '@app/dossier/providers/dsn/DsnAtResumeListProvider';
import useRapportImportDetail                         from '@app/dossier/providers/edp/RapportImportDetailProvider';
import useRapportImportLast                           from '@app/dossier/providers/edp/RapportImportLastProvider';
import useFichesHistorisationList                     from '@app/dossier/providers/fiches/FichesHistorisationListProvider';
import { moduleRoute as DossierModule }               from '@app/dossier/resources/common/Router';
// @app/notification (group @app/notification)
import { useClientNotification } from '@app/notification/ClientNotificationProvider';
// @core (Here from is aligned based on the whole group because of useUserContext length)
import type {
    TDataProviderReturn,
    WsDataModel
}                         from '@core/models/ProviderModel';
import { useUserContext } from '@core/providers/contexts/UserContextProvider';
import { getLocationId }  from '@core/utils/misc';
// @library (group @library)
import { getDateFormat }      from '@library/utils/dates';
import { useSearch }          from '@library/utils/search';
import { getPageStyleHeight } from '@library/utils/styles';
/*
*  Utils (group Utils)
*  Import nommée donc nous faisons ce raisonnement :
*  On parcour les noms des imports par longueur = getTextPreview.length : Ce qui ici nous donne 14 charactère
*  Nous avons ensuite 4 espace d'indentation
*  Sur la ligne on a donc 4 charactère (Parce que on as 3 espaces et une accolade de fermeture '}')
*  + 1 charactère d'espacement avant from (Toujours)
*  Ce qui nous donne 19 charactères avant "from 'yutils/text'".
*/
import { getPalette } from 'yutils/colors';
import {
    conjugate,
    getTextPreview
}                     from 'yutils/text';
`;

const extraTestCases = `
// Import avec ligne vide (devrait être filtré)

// Import avec as mal formé (devrait donner une erreur explicative)
import React as R from 'react';

// Import avec des commentaires en fin de ligne
import { useState } from 'react'; // Commentaire qui sera supprimé

// Import écrit sur plusieurs lignes
import {
  Component,
  Fragment,
  useState // Commentaire en fin de ligne à l'intérieur d'accolades
} from 'react';

// Import avec type inline et plusieurs composants
import { useCallback, type ChangeEvent, useEffect } from 'react';

// Import avec alias correctement formé
import { Component as C } from 'react';

// Import par défaut avec alias correctement formé
import React as R2 from 'react';

// Type import
import type { FC } from 'react';

// Import avec specifiers répétés (devrait être dédupliqué)
import { useState, useEffect, useState } from 'react';
`;

// Ajout de cas de test supplémentaires pour les scénarios problématiques

const additionalSpecialCases = `
// Import par défaut avec alias (maintenant correctement géré)
import React as R from 'react';

// Import d'espace de noms (namespace)
import * as React from 'react';

// Import avec duplications (maintenant correctement détecté)
import { useState, useEffect, useState } from 'react';

// Import avec plusieurs alias
import { Component as C, Fragment as F } from 'react';

// Import avec mélange de types et d'alias
import { useState, type FC, useEffect, type ComponentType as CT } from 'react';

// Import avec éléments par défaut et nommés
import React, { useState, useEffect } from 'react';

// Import d'espace de noms suivi d'un import nommé (cas inhabituel)
import * as React, { useState } from 'react';
`;

// Fonction de test spécifique pour les imports avec alias
function testAliasImports() {
  console.log('\n=== Test 3: Gestion des alias et cas spéciaux ===');
  const results = parseImports(additionalSpecialCases, config);
  
  console.log('\n=== Imports Valides ===');
  results.groups.forEach(group => {
    console.log(`\nGroupe: ${group.name} (${group.imports.length} imports)`);
    group.imports.forEach((imp, idx) => {
      console.log(`[${idx + 1}] Type: ${imp.type}, Source: ${imp.source}`);
      console.log(`    Specifiers: ${imp.specifiers.join(', ')}`);
      console.log(`    Raw: ${imp.raw}`);
    });
  });
  
  console.log('\n=== Imports Invalides ===');
  if (results.invalidImports && results.invalidImports.length > 0) {
    results.invalidImports.forEach((invalid, index) => {
      console.log(`[${index + 1}] Raw: "${invalid.raw}"`);
      console.log(`    Error: ${invalid.error}`);
      console.log('---');
    });
  } else {
    console.log('Aucun import invalide détecté dans les cas spéciaux.');
  }
  
  // Écrire les résultats dans un fichier
  const timestamp = Date.now();
  const outputPath = path.resolve(__dirname, `../results/test-special-cases-${timestamp}.json`);
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Résultats des cas spéciaux écrits dans: ${outputPath}`);
}

const duplicatesTestCases = `
// Test 1: Doublons simples
import { useState, useState, useEffect } from 'react';

// Test 2: Doublons avec type
import { type FC, type FC, Component } from 'react';

// Test 3: Doublons avec alias
import { Component, Component as C, Component } from 'react';

// Test 4: Mélange de doublons variés
import { useState, type FC, useState, Component as C, type FC, Component, Component as Comp } from 'react';

// Test 5: Doublons dans un import multi-lignes
import {
  useState,
  useEffect,
  useState,
  useContext,
  useEffect
} from 'react';

// Test 6: Doublons avec commentaires
import { 
  useState, // State hook
  useEffect, // Effect hook
  useState  // Doublon qui doit être supprimé
} from 'react';
`;

// Ajouter cette fonction de test spécifique dans test.ts
function testDuplicateCorrection() {
  console.log('\n=== Test spécifique: Correction automatique des doublons ===');
  
  const timestamp = Date.now();
  const results = parseImports(duplicatesTestCases, config);
  
  console.log('\n=== Imports Valides Après Correction ===');
  results.groups.forEach(group => {
    console.log(`\nGroupe: ${group.name} (${group.imports.length} imports)`);
    group.imports.forEach((imp, idx) => {
      console.log(`[${idx + 1}] Type: ${imp.type}, Source: ${imp.source}`);
      console.log(`    Specifiers: ${imp.specifiers.join(', ')}`);
      console.log(`    Raw: ${imp.raw}`);
    });
  });
  
  console.log('\n=== Imports Invalides (ne devraient plus exister) ===');
  if (results.invalidImports && results.invalidImports.length > 0) {
    results.invalidImports.forEach((invalid, index) => {
      console.log(`[${index + 1}] Raw: "${invalid.raw}"`);
      console.log(`    Error: ${invalid.error}`);
      console.log('---');
    });
  } else {
    console.log('Aucun import invalide détecté - Tous les doublons ont été corrigés automatiquement!');
  }
  
  // Écrire les résultats dans un fichier
  const outputPath = path.resolve(__dirname, `../results/test-duplicate-correction-${timestamp}.json`);
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Résultats écrits dans: ${outputPath}`);
  
  return results;
}

/**
 * Fonction pour tester les cas d'erreur
 * Vérifie que les imports qui ne peuvent pas être analysés ou corrigés renvoient bien une erreur
 */
function testErrorCases() {
  console.log('\n=== Test des cas d\'erreur ===');
  
  // Tableau de cas de test avec des erreurs attendues
  const errorCases = [
    {
      name: "Import avec syntaxe incorrecte",
      code: "import React as from 'react';",
      shouldFail: true
    },
    {
      name: "Import avec alias malformé",
      code: "import Component as C, { useState } from 'react';",
      shouldFail: true
    },
    {
      name: "Import avec source manquante",
      code: "import { useState };",
      shouldFail: true
    },
    {
      name: "Import avec accolades non fermées",
      code: "import { useState, useEffect from 'react';",
      shouldFail: true
    },
    {
      name: "Import avec namespace et import nommé (syntaxe invalide)",
      code: "import * as React, { useState } from 'react';",
      shouldFail: true
    },
    {
      name: "Import avec caractères spéciaux invalides",
      code: "import { useState, use$Effect } from 'react';",
      shouldFail: false // Devrait réussir car les $ sont valides dans les identifiants JS
    },
    {
      name: "Import avec guillemets non fermés",
      code: "import { useState } from 'react;",
      shouldFail: true
    },
    {
      name: "Import avec mélange de guillemets",
      code: "import { useState } from \"react';",
      shouldFail: true
    },
    {
      name: "Import avec point-virgule manquant",
      code: "import { useState } from 'react'",
      shouldFail: false // Le parser devrait ajouter le point-virgule manquant
    },
    {
      name: "Import vide",
      code: "import {} from 'react';",
      shouldFail: false // Syntaxiquement valide même si inutile
    }
  ];
  
  // Exécuter les tests
  let passedTests = 0;
  let totalTests = errorCases.length;
  
  for (const testCase of errorCases) {
    console.log(`\nTest: ${testCase.name}`);
    const result = parseImports(testCase.code, config);
    
    if (checkOutput(testCase, result)) {
      passedTests++;
    }
  }
  
  // Afficher le résumé
  console.log(`\n=== Résumé des tests d'erreur ===`);
  console.log(`Tests réussis: ${passedTests}/${totalTests} (${Math.round(passedTests/totalTests*100)}%)`);
  
  return { passedTests, totalTests };
}

/**
 * Vérifie si le résultat du parsing correspond au comportement attendu
 */
function checkOutput(testCase: any, result: any) {
  const hasInvalidImports = result.invalidImports && result.invalidImports.length > 0;
  
  if (testCase.shouldFail && !hasInvalidImports) {
    console.log(`❌ ÉCHEC: "${testCase.name}" devrait échouer mais a été analysé avec succès`);
    return false;
  } else if (!testCase.shouldFail && hasInvalidImports) {
    console.log(`❌ ÉCHEC: "${testCase.name}" devrait réussir mais a échoué avec l'erreur: ${result.invalidImports[0].error}`);
    return false;
  } else {
    console.log(`✅ SUCCÈS: "${testCase.name}" - Comportement attendu confirmé`);
    if (hasInvalidImports) {
      console.log(`   Erreur: ${result.invalidImports[0].error}`);
    }
    return true;
  }
}

// Fonction pour tester les cas problématiques
function testProblematicImports() {
  console.log('\n=== Test: Cas problématiques d\'imports ===');
  const results = parseImports(problematicImports, config);
  
  console.log('\n=== Imports Valides ===');
  results.groups.forEach(group => {
    console.log(`\nGroupe: ${group.name} (${group.imports.length} imports)`);
    group.imports.forEach((imp, idx) => {
      console.log(`[${idx + 1}] Type: ${imp.type}, Source: ${imp.source}`);
      console.log(`    Specifiers: ${imp.specifiers.join(', ')}`);
      console.log(`    Raw: ${imp.raw}`);
    });
  });
  
  console.log('\n=== Imports Invalides ===');
  if (results.invalidImports && results.invalidImports.length > 0) {
    results.invalidImports.forEach((invalid, index) => {
      console.log(`[${index + 1}] Raw: "${invalid.raw}"`);
      console.log(`    Error: ${invalid.error}`);
      console.log('---');
    });
  } else {
    console.log('Aucun import invalide détecté dans les cas problématiques.');
  }
  
  // Écrire les résultats dans un fichier
  const timestamp = Date.now();
  const outputPath = path.resolve(__dirname, `../results/test-problematic-imports-${timestamp}.json`);
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Résultats des cas problématiques écrits dans: ${outputPath}`);
  
  return results;
}

// Fonction pour tester les cas supplémentaires
function testExtraCases() {
  console.log('\n=== Test: Cas supplémentaires d\'imports ===');
  const results = parseImports(extraTestCases, config);
  
  console.log('\n=== Imports Valides ===');
  results.groups.forEach(group => {
    console.log(`\nGroupe: ${group.name} (${group.imports.length} imports)`);
    group.imports.forEach((imp, idx) => {
      console.log(`[${idx + 1}] Type: ${imp.type}, Source: ${imp.source}`);
      console.log(`    Specifiers: ${imp.specifiers.join(', ')}`);
      console.log(`    Raw: ${imp.raw}`);
    });
  });
  
  console.log('\n=== Imports Invalides ===');
  if (results.invalidImports && results.invalidImports.length > 0) {
    results.invalidImports.forEach((invalid, index) => {
      console.log(`[${index + 1}] Raw: "${invalid.raw}"`);
      console.log(`    Error: ${invalid.error}`);
      console.log('---');
    });
  } else {
    console.log('Aucun import invalide détecté dans les cas supplémentaires.');
  }
  
  // Écrire les résultats dans un fichier
  const timestamp = Date.now();
  const outputPath = path.resolve(__dirname, `../results/test-extra-cases-${timestamp}.json`);
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Résultats des cas supplémentaires écrits dans: ${outputPath}`);
  
  return results;
}

// Modification de run pour inclure ce test
const runExtendedWithDuplicateTest = () => {
  const timestamp = Date.now();
  console.time('Parse imports execution time');
  
  try {
    // Test 1: Cas problématiques d'imports
    console.log('\n=== Exécution du test des cas problématiques ===');
    const problematicResults = testProblematicImports();
    
    // Test 2: Cas supplémentaires
    console.log('\n=== Exécution du test des cas supplémentaires ===');
    const extraResults = testExtraCases();
    
    // Test 3: Gestion des alias et cas spéciaux
    console.log('\n=== Exécution du test des alias ===');
    testAliasImports();
    
    // Test 4: Correction des doublons
    console.log('\n=== Exécution du test de correction des doublons ===');
    const duplicateResults = testDuplicateCorrection();
    
    // Vérifier l'efficacité de la correction
    const duplicateSpecsCount = duplicateResults.originalImports.length;
    const invalidCount = duplicateResults.invalidImports?.length || 0;
    const validCount = duplicateResults.groups.reduce((acc, group) => acc + group.imports.length, 0);
    
    console.log(`\n=== Statistiques de correction des doublons ===`);
    console.log(`Imports originaux: ${duplicateSpecsCount}`);
    console.log(`Imports valides après correction: ${validCount}`);
    console.log(`Imports qui n'ont pas pu être corrigés: ${invalidCount}`);
    
    if (invalidCount === 0 && validCount > 0) {
      console.log(`✅ SUCCÈS: Tous les imports avec doublons ont été corrigés automatiquement!`);
    } else if (invalidCount > 0) {
      console.log(`⚠️ ATTENTION: Certains imports avec doublons n'ont pas pu être corrigés.`);
    }
    
    // Test 5: Cas d'erreur
    console.log('\n=== Exécution du test des cas d\'erreur ===');
    const errorResults = testErrorCases();
    console.log(`\nTests d'erreur: ${errorResults.passedTests}/${errorResults.totalTests} tests réussis`);
    
    // Résumé global des tests
    console.log('\n=== Résumé global des tests ===');
    console.log('Tous les tests ont été exécutés avec succès.');
    
    console.timeEnd('Parse imports execution time');
  } catch (error) {
    console.error('Parser failed with error:', error);
  }
};

// Remplacer run par la version qui inclut les tests d'erreur
const run = runExtendedWithDuplicateTest;

run();
