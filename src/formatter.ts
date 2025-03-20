import { FormatterConfig, FormattedImportGroup } from './types';
import { isEmptyLine, logError, showMessage } from './utils/misc';
import { logDebug } from './utils/log';
import { ParsedImport, ParserResult } from 'tidyimport-parser';

function alignFromKeyword(line: string, fromIndex: number, maxFromIndex: number): string {
    if (fromIndex <= 0 || line.indexOf('from') === -1) {
        return line;
    }

    const beforeFrom = line.substring(0, fromIndex);
    const afterFrom = line.substring(fromIndex);
    
    const paddingSize = maxFromIndex - fromIndex;
    const padding = ' '.repeat(paddingSize);

    return beforeFrom + padding + afterFrom;
}

function alignMultilineFromKeyword(line: string, fromIndex: number, maxFromIndex: number): string {
    const lines = line.split('\n');
    if (lines.length < 2) {
        return line;
    }
    
    const lastLineIndex = lines.length - 1;
    const lastLine = lines[lastLineIndex];
    
    const fromIndexInLastLine = lastLine.indexOf('from');
    if (fromIndexInLastLine === -1) {
        return line;
    }
    
    const closeBraceIndex = lastLine.indexOf('}');
    if (closeBraceIndex === -1) return line;
    
    const beforeContent = lastLine.substring(0, closeBraceIndex + 1);
    const exactSpaces = maxFromIndex - (closeBraceIndex + 1);
    const fromAndAfter = lastLine.substring(fromIndexInLastLine);
    
    const newLastLine = beforeContent + ' '.repeat(exactSpaces) + fromAndAfter;
    lines[lastLineIndex] = newLastLine;
    
    return lines.join('\n');
}

function alignImportsInGroup(importLines: string[]): string[] {
    if (importLines.length === 0) {
        return importLines;
    }
    
    const fromIndices = new Map<string, number>();
    
    let globalMaxFromPosition = 0;
    
    for (const line of importLines) {
        if (line.includes('\n')) {
            const lines = line.split('\n');
            
            let longestSpecifier = 0;
            let longestSpecifierIndex = -1;
            
            for (let i = 1; i < lines.length - 1; i++) {
                const specifierLine = lines[i].trim();
                const specifierWithoutComma = specifierLine.replace(/,$/, '').trim();
                
                if (specifierWithoutComma.length > longestSpecifier) {
                    longestSpecifier = specifierWithoutComma.length;
                    longestSpecifierIndex = i;
                }
            }
            
            let idealFromPosition = 4 + longestSpecifier + 1;
            
            const lastSpecifierIndex = lines.length - 2;
            if (longestSpecifierIndex !== lastSpecifierIndex && longestSpecifierIndex !== -1) {
                idealFromPosition += 1;
            }
            
            globalMaxFromPosition = Math.max(globalMaxFromPosition, idealFromPosition);
            
            const lastLine = lines[lines.length - 1];
            const fromIndex = lastLine.indexOf('from');
            if (fromIndex !== -1) {
                fromIndices.set(line, fromIndex);
            }
        } else {
            const importParts = line.split('from');
            if (importParts.length === 2) {
                const beforeFrom = importParts[0].trim();
                const fromPosition = line.indexOf('from');
                fromIndices.set(line, fromPosition);
                globalMaxFromPosition = Math.max(globalMaxFromPosition, beforeFrom.length + 1);
            }
        }
    }
    
    return importLines.map(line => {
        const fromIndex = fromIndices.get(line);
        
        if (fromIndex === undefined) {
            return line;
        }
        
        if (!line.includes('\n')) {
            return alignFromKeyword(line, fromIndex, globalMaxFromPosition);
        } else {
            return alignMultilineFromKeyword(line, fromIndex, globalMaxFromPosition);
        }
    });
}

function cleanUpLines(lines: string[]): string[] {
    const cleanedLines: string[] = [];
    let consecutiveEmptyLines = 0;
    const seenGroupComments = new Set<string>();
    let inMultilineComment = false;

    for (const currentLine of lines) {
        // Normaliser la ligne pour la comparaison
        const normalizedLine = currentLine.trim();
        
        // Gérer les commentaires multi-lignes
        if (normalizedLine.includes('/*')) {
            inMultilineComment = true;
        }
        
        if (inMultilineComment) {
            if (normalizedLine.includes('*/')) {
                inMultilineComment = false;
            }
            continue; // Ignorer la ligne
        }
        
        // Vérifier si c'est un commentaire de groupe (commence par "// " suivi d'un nom de groupe)
        if (normalizedLine.startsWith('// ')) {
            // Extraire le nom du groupe (ce qui suit "// ")
            const groupName = normalizedLine.substring(3).trim();
            
            // Si nous avons déjà vu ce commentaire de groupe, l'ignorer
            if (seenGroupComments.has(groupName)) {
                continue;
            }
            
            // Sinon, l'enregistrer et le conserver
            seenGroupComments.add(groupName);
        }
        // Ignorer tous les autres types de commentaires
        else if (normalizedLine.startsWith('//')) {
            continue;
        }

        // Gérer les lignes vides
        if (isEmptyLine(currentLine)) {
            consecutiveEmptyLines++;
            if (consecutiveEmptyLines > 1) {
                continue;
            }
        } else {
            consecutiveEmptyLines = 0;
        }

        cleanedLines.push(currentLine);
    }

    // Supprimer la dernière ligne vide si elle existe
    if (cleanedLines.length > 0 && isEmptyLine(cleanedLines[cleanedLines.length - 1])) {
        cleanedLines.pop();
    }

    // Ajouter deux lignes vides à la fin
    cleanedLines.push('');
    cleanedLines.push('');

    return cleanedLines;
}

function formatImportLine(importItem: ParsedImport): string {
    const { type, source, specifiers, raw } = importItem;

    if (type === 'sideEffect' || specifiers.length === 0) {
        return `import '${source}';`;
    }

    if (type === 'default' && specifiers.length === 1) {
        return `import ${specifiers[0]} from '${source}';`;
    }

    if (type === 'typeDefault' && specifiers.length === 1) {
        return `import type ${specifiers[0]} from '${source}';`;
    }

    if ((type === 'named' || type === 'typeNamed') && specifiers.length === 1) {
        const typePrefix = type === 'typeNamed' ? 'type ' : '';
        return `import ${typePrefix}{ ${specifiers[0]} } from '${source}';`;
    }

    if ((type === 'named' || type === 'typeNamed') && specifiers.length > 1) {
        const typePrefix = type === 'typeNamed' ? 'type ' : '';
        const sortedSpecifiers = [...specifiers].sort((a, b) => a.localeCompare(b));
        return `import ${typePrefix}{\n    ${sortedSpecifiers.join(',\n    ')}\n} from '${source}';`;
    }

    return raw;
}

function groupImportsByModuleAndType(imports: ParsedImport[]): Map<string, Map<string, ParsedImport>> {
    const groupedByModule = new Map<string, Map<string, ParsedImport>>();
    
    // Ensemble pour suivre les imports déjà traités (pour éviter les doublons)
    const processedImportKeys = new Set<string>();
    
    for (const importItem of imports) {
        // Créer une clé unique pour cet import basée sur source, type et specifiers
        const importKey = `${importItem.type}:${importItem.source}:${importItem.specifiers.sort().join(',')}`;
        
        // Vérifier si cet import a déjà été traité
        if (processedImportKeys.has(importKey)) {
            continue; // Ignorer les doublons d'imports
        }
        
        processedImportKeys.add(importKey);
        
        if (!groupedByModule.has(importItem.source)) {
            groupedByModule.set(importItem.source, new Map<string, ParsedImport>());
        }
        
        const moduleImports = groupedByModule.get(importItem.source)!;
        
        if (!moduleImports.has(importItem.type)) {
            moduleImports.set(importItem.type, { ...importItem, specifiers: [...importItem.specifiers] });
        } else {
            const existingImport = moduleImports.get(importItem.type)!;
            const mergedSpecifiers = new Set([...existingImport.specifiers, ...importItem.specifiers]);
            existingImport.specifiers = Array.from(mergedSpecifiers);
        }
    }
    
    return groupedByModule;
}

export function formatImportsFromParser(
    sourceText: string,
    importRange: { start: number; end: number },
    parserResult: ParserResult,
): string {
    if (importRange.start === importRange.end || !parserResult.groups.length) {
        return sourceText;
    }

    try {
        // Extraire le texte courant de la section d'imports
        const currentImportText = sourceText.substring(importRange.start, importRange.end);
        
        // Vérifier s'il y a des imports dynamiques
        if (currentImportText.includes('import(') || 
            currentImportText.includes('React.lazy') ||
            /await\s+import/.test(currentImportText)) {
            throw new Error('Dynamic imports detected in the static imports section');
        }
        
        // Supprimer TOUS les commentaires, y compris les commentaires multi-lignes
        const currentLines = currentImportText.split('\n');
        const importsOnly: string[] = [];
        let inMultilineComment = false;
        
        for (const line of currentLines) {
            const trimmedLine = line.trim();
            
            // Gérer les commentaires multi-lignes
            if (trimmedLine.includes('/*')) {
                inMultilineComment = true;
            }
            
            if (inMultilineComment) {
                if (trimmedLine.includes('*/')) {
                    inMultilineComment = false;
                }
                continue; // Ignorer la ligne
            }
            
            // Ignorer les commentaires sur une seule ligne
            if (trimmedLine.startsWith('//')) {
                continue;
            }
            
            // Garder les imports et les lignes vides
            importsOnly.push(line);
        }
        
        // Utiliser une Map pour regrouper les imports par nom de groupe
        const importsByGroupName = new Map<string, ParsedImport[]>();
        
        // Trier les groupes par ordre
        const sortedGroups = [...parserResult.groups].sort((a, b) => a.order - b.order);
        
        // Regrouper tous les imports par nom de groupe
        for (const group of sortedGroups) {
            if (group.imports && group.imports.length) {
                importsByGroupName.set(group.name, [...group.imports]);
            }
        }
        
        // Formater les groupes d'imports
        const formattedGroups: FormattedImportGroup[] = [];
        
        // Ensemble pour suivre les imports déjà traités (pour éviter les doublons)
        const processedImports = new Set<string>();
        
        for (const [groupName, imports] of importsByGroupName.entries()) {
            if (!imports.length) continue;
            
            const groupResult: FormattedImportGroup = {
                groupName: groupName,
                commentLine: `// ${groupName}`,
                importLines: []
            };
            
            // Trier les imports dans ce groupe
            const sortedImports = [...imports].sort((a, b) => {
                if (a.isPriority && !b.isPriority) return -1;
                if (!a.isPriority && b.isPriority) return 1;
                
                if (a.source !== b.source) {
                    return a.source.localeCompare(b.source);
                }
                
                const typeOrder = {
                    'sideEffect': 0,
                    'default': 1,
                    'named': 2,
                    'typeDefault': 3,
                    'typeNamed': 4
                };
                
                return (typeOrder[a.type as keyof typeof typeOrder] || 999) - 
                       (typeOrder[b.type as keyof typeof typeOrder] || 999);
            });
            
            // Grouper les imports par module et type, en dédupliquant
            const groupedImports = groupImportsByModuleAndType(sortedImports);
            
            // Formater chaque import
            for (const [_, moduleImports] of groupedImports) {
                const moduleImportsArray = Array.from(moduleImports.values());
                
                moduleImportsArray.sort((a, b) => {
                    const typeOrder = {
                        'sideEffect': 0,
                        'default': 1,
                        'named': 2,
                        'typeDefault': 3,
                        'typeNamed': 4
                    };
                    
                    return (typeOrder[a.type as keyof typeof typeOrder] || 999) - 
                           (typeOrder[b.type as keyof typeof typeOrder] || 999);
                });
                
                for (const importItem of moduleImportsArray) {
                    // Créer une clé unique pour cet import basée sur source et specifiers
                    const importKey = `${importItem.type}:${importItem.source}:${importItem.specifiers.sort().join(',')}`;
                    
                    // Vérifier si cet import a déjà été traité
                    if (processedImports.has(importKey)) {
                        continue; // Ignorer les doublons d'imports
                    }
                    
                    const formattedImport = formatImportLine(importItem);
                    groupResult.importLines.push(formattedImport);
                    processedImports.add(importKey);
                }
            }
            
            // N'ajouter le groupe que s'il contient des imports
            if (groupResult.importLines.length > 0) {
                formattedGroups.push(groupResult);
            }
        }
        
        // Construire le texte formaté, avec un seul commentaire par groupe
        const formattedLines: string[] = [];
        const processedGroupNames = new Set<string>();
        
        for (const group of formattedGroups) {
            // N'ajouter le commentaire de groupe que s'il n'a pas déjà été traité
            if (!processedGroupNames.has(group.groupName)) {
                formattedLines.push(group.commentLine);
                processedGroupNames.add(group.groupName);
            }
            
            // Aligner les imports et les ajouter
            const alignedImports = alignImportsInGroup(group.importLines);
            formattedLines.push(...alignedImports);
            
            // Ajouter une ligne vide après le groupe
            formattedLines.push('');
        }
        
        // Nettoyer les lignes (supprimer les doublons de lignes vides, etc.)
        const cleanedLines = cleanUpLines(formattedLines);
        const formattedText = cleanedLines.join('\n');
        
        return (
            sourceText.substring(0, importRange.start) +
            formattedText +
            sourceText.substring(importRange.end)
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logDebug(`Error while formatting imports: ${errorMessage}`);
        return sourceText;
    }
}

function findImportsRange(text: string): { start: number; end: number } | null {
    const lines = text.split('\n');
    let startLine = -1;
    let endLine = -1;
    let inMultilineImport = false;
    let inMultilineComment = false;
    let foundNonImportCode = false;
    let foundDynamicImport = false;
    let dynamicImportLine = -1;
    
    const dynamicImportRegex = /(?:await\s+)?import\s*\(|React\.lazy\s*\(\s*\(\s*\)\s*=>\s*import/;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Gérer les commentaires multi-lignes
        if (line.includes('/*')) {
            inMultilineComment = true;
        }
        
        if (inMultilineComment) {
            if (line.includes('*/')) {
                inMultilineComment = false;
            }
            continue;
        }
        
        // Ignorer les lignes vides et les commentaires sur une seule ligne
        if (line === '' || line.startsWith('//')) {
            continue;
        }
        
        const lineWithoutComment = line.split('//')[0].trim();
        
        // Détecter les imports statiques
        if (lineWithoutComment.startsWith('import ')) {
            if (startLine === -1) {
                startLine = i;
            }
            
            if (foundNonImportCode) {
                logDebug(`Non-import code found before an import at line ${i+1}`);
                return null;
            }
            
            // Détecter les imports multilignes
            if (lineWithoutComment.includes('{') && !lineWithoutComment.includes('}') && !lineWithoutComment.endsWith(';')) {
                inMultilineImport = true;
            } else if (lineWithoutComment.endsWith(';')) {
                endLine = i;
                inMultilineImport = false;
            }
        }
        else if (inMultilineImport) {
            // Continuer à suivre un import multiligne
            if (lineWithoutComment.includes('}') && lineWithoutComment.endsWith(';')) {
                endLine = i;
                inMultilineImport = false;
            }
        }
        else if (dynamicImportRegex.test(lineWithoutComment)) {
            // Détecter les imports dynamiques
            foundDynamicImport = true;
            dynamicImportLine = i + 1;
            
            if (startLine !== -1) {
                logDebug(`Dynamic import found at line ${i+1} in the middle of static imports`);
                return null;
            }
            
            foundNonImportCode = true;
        }
        else if (lineWithoutComment && !lineWithoutComment.startsWith('export')) {
            // Détecter le code non-import
            if (startLine !== -1 && !foundNonImportCode) {
                foundNonImportCode = true;
                break;
            }
            
            foundNonImportCode = true;
        }
    }
    
    // Vérifier les mélanges d'imports dynamiques et statiques
    if (foundDynamicImport && startLine !== -1) {
        logDebug(`Mix of dynamic imports (line ${dynamicImportLine}) and static imports (starting line ${startLine+1})`);
        return null;
    }
    
    // Si aucun import n'a été trouvé
    if (startLine === -1) {
        return { start: 0, end: 0 };
    }
    
    // Reculer pour inclure les commentaires avant le premier import
    while (startLine > 0) {
        const prevLine = lines[startLine - 1].trim();
        if (prevLine === '' || prevLine.startsWith('//') || prevLine.includes('/*')) {
            startLine--;
        } else {
            break;
        }
    }
    
    // Calculer les positions de début et de fin
    const startPos = lines.slice(0, startLine).join('\n').length + (startLine > 0 ? 1 : 0);
    const endPos = lines.slice(0, endLine + 1).join('\n').length;
    
    // Inclure les lignes vides après la dernière déclaration d'import
    const remainingText = text.substring(endPos);
    const remainingLines = remainingText.split('\n');
    let additionalLines = 0;
    
    for (const line of remainingLines) {
        if (line.trim() === '') {
            additionalLines += line.length + 1;
        } else {
            break;
        }
    }
    
    return { 
        start: startPos, 
        end: endPos + additionalLines 
    };
}

export function formatImports(
    sourceText: string, 
    config: FormatterConfig,
    parserResult?: ParserResult
): { text: string; error?: string } {
    const importRange = findImportsRange(sourceText);
    
    if (importRange === null) {
        return {
            text: sourceText,
            error: 'Dynamic imports or non-import code was detected among static imports.'
        };
    }
    
    if (importRange.start === importRange.end) {
        return { text: sourceText };
    }
    
    if (!parserResult) {
        logDebug('No parser result provided, unable to format imports');
        return { text: sourceText };
    }
    
    try {
        const formattedText = formatImportsFromParser(sourceText, importRange, parserResult);
        return { text: formattedText };
    } catch (error: unknown) {
        const errorMessage = (error as Error).message;
        showMessage.error(`An error occurred while formatting imports: ${errorMessage}`);
        logError(`An error occurred while formatting imports: ${errorMessage}`);
        return { text: sourceText, error: errorMessage };
    }
}