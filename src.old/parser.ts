import * as ts from 'typescript';
import { FormattedImport, ImportGroup } from './types';
import { DEFAULT_IMPORT_GROUPS } from './utils/config';
import { logDebug } from './utils/log';

// Constantes pour les expressions régulières fréquemment utilisées
const TYPE_KEYWORD_REGEX = /^type\s+/;

// Cache pour les résultats de getImportGroup
const importGroupCache = new Map<string, string>();

function getImportGroup(moduleName: string, importGroups: ImportGroup[]): string {
    // Utiliser le cache pour éviter les recherches répétitives
    if (importGroupCache.has(moduleName)) {
        return importGroupCache.get(moduleName)!;
    }

    const importGroup = importGroups.find((group) => group.regex.test(moduleName));
    const groupName = importGroup ? importGroup.name : 'Misc';
    
    // Stocker dans le cache
    importGroupCache.set(moduleName, groupName);
    return groupName;
}

// Fonction optimisée pour traiter les imports nommés
function parseNamedImports(
    namedBindings: ts.NamedImports,
    sourceFile: ts.SourceFile
): { regular: Set<string>; types: Set<string> } {
    const regularImports = new Set<string>();
    const typeImports = new Set<string>();
    
    for (const element of namedBindings.elements) {
        const sourceText = sourceFile.text.substring(
            element.getStart(sourceFile),
            element.getEnd()
        );
        
        // Extract just the name without comments
        let importName = '';
        if (element.propertyName) {
            importName = `${element.propertyName.text} as ${element.name.text}`;
        } else {
            importName = element.name.text;
        }
        
        if (TYPE_KEYWORD_REGEX.test(sourceText)) {
            typeImports.add(importName);
        } else {
            regularImports.add(importName);
        }
    }
    
    return { regular: regularImports, types: typeImports };
}

export function parseImports(
    importNodes: ts.ImportDeclaration[],
    sourceFile: ts.SourceFile,
    importGroups: ImportGroup[] = DEFAULT_IMPORT_GROUPS
): FormattedImport[] {
    // Validation d'entrée
    if (!importNodes || importNodes.length === 0) {
        return [];
    }
    
    if (!sourceFile) {
        logDebug('parseImports: Fichier source manquant');
        return [];
    }
    
    // Utiliser DEFAULT_IMPORT_GROUPS si aucun groupe n'est fourni
    const groups = importGroups.length > 0 ? importGroups : DEFAULT_IMPORT_GROUPS;
    
    // Préparer le résultat (avec taille pré-allouée approximative)
    const result: FormattedImport[] = [];
    
    try {
        for (const node of importNodes) {
            // Ignorer les nœuds invalides
            if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) {
                continue;
            }

            const moduleName = node.moduleSpecifier.text;
            const groupName = getImportGroup(moduleName, groups);
            
            // Trouver l'objet ImportGroup correspondant une seule fois par module
            const importGroup = groups.find((g) => g.name === groupName) ?? { name: 'Misc', regex: /.*/, order: 0 };
            
            // Collections pour les noms d'imports
            const importNames = new Set<string>();
            const typeImportNames = new Set<string>();
            
            let isTypeImport = false;
            let isDefaultImport = false;
            let hasNamedImports = false;
            
            if (node.importClause) {
                const importClause = node.importClause;
                isTypeImport = !!importClause.isTypeOnly;
                
                // Traitement de l'import par défaut
                if (importClause.name) {
                    isDefaultImport = true;
                    importNames.add(importClause.name.text);
                }
                
                // Traitement des imports nommés ou namespace
                if (importClause.namedBindings) {
                    if (ts.isNamedImports(importClause.namedBindings)) {
                        const { regular, types } = parseNamedImports(
                            importClause.namedBindings, 
                            sourceFile
                        );
                        
                        // Ajouter tous les noms d'imports aux ensembles
                        regular.forEach(name => importNames.add(name));
                        types.forEach(name => typeImportNames.add(name));
                        
                        hasNamedImports = regular.size > 0;
                    } else if (ts.isNamespaceImport(importClause.namedBindings)) {
                        importNames.add(`* as ${importClause.namedBindings.name.text}`);
                        hasNamedImports = true;
                    }
                }
            }
            
            // Extraire le texte original pour référence
            const statement = sourceFile.text.substring(
                node.getStart(sourceFile),
                node.getEnd()
            );
            
            // Créer l'import principal s'il contient des noms réguliers ou s'il s'agit d'un import de side-effect
            if (importNames.size > 0 || !node.importClause) {
                result.push({
                    statement,
                    group: importGroup,
                    moduleName,
                    importNames: Array.from(importNames),
                    isTypeImport,
                    isDefaultImport,
                    hasNamedImports
                });
            }
            
            // Créer un import séparé pour les types inline si nécessaire
            if (typeImportNames.size > 0) {
                result.push({
                    statement: `import type { ${Array.from(typeImportNames).join(', ')} } from '${moduleName}';`,
                    group: importGroup,
                    moduleName,
                    importNames: Array.from(typeImportNames),
                    isTypeImport: true,
                    isDefaultImport: false,
                    hasNamedImports: true
                });
            }
        }
    } catch (error) {
        logDebug(`Erreur dans parseImports: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return result;
}
