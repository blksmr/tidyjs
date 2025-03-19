import { FormatterConfig, FormattedImportGroup } from './types';
import { isEmptyLine, isCommentLine } from './utils/misc';
import { logDebug } from './utils/log';
import { ParsedImport, ParserResult } from 'tidyimport-parser';

/**
 * Aligne les imports pour que les mots-clés 'from' soient alignés
 */
function alignFromKeyword(line: string, fromIndex: number, maxFromIndex: number, config: FormatterConfig): string {
    if (fromIndex <= 0 || line.indexOf('from') === -1) {
        return line;
    }

    const beforeFrom = line.substring(0, fromIndex);
    const afterFrom = line.substring(fromIndex);
    const paddingSize = maxFromIndex - fromIndex + config.alignmentSpacing;
    const padding = ' '.repeat(paddingSize);

    return beforeFrom + padding + afterFrom;
}

/**
 * Trouve l'index du mot-clé 'from' dans une ligne d'import
 */
function getFromIndex(line: string, isMultiline: boolean): number {
    if (isMultiline) {
        // Pour les imports multilignes, chercher 'from' sur la dernière ligne
        const lines = line.split('\n');
        const lastLine = lines[lines.length - 1];
        const fromIndex = lastLine.indexOf('from');
        if (fromIndex !== -1) {
            // Calculer l'index global en ajoutant la longueur des lignes précédentes
            return lines.slice(0, lines.length - 1).join('\n').length + fromIndex + 1;
        }
        return -1;
    }

    // Pour les imports simples, trouver directement l'index
    return line.indexOf('from');
}

/**
 * Nettoie les lignes pour éviter les commentaires dupliqués et les lignes vides consécutives
 */
function cleanUpLines(lines: string[]): string[] {
    const cleanedLines: string[] = [];
    let previousLine = '';
    let consecutiveEmptyLines = 0;

    for (const currentLine of lines) {
        // Ne pas ajouter de commentaires identiques à la suite
        if (isCommentLine(currentLine) && previousLine === currentLine) {
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
        previousLine = currentLine;
    }

    // Supprimer la dernière ligne vide si elle existe
    if (cleanedLines.length > 0 && isEmptyLine(cleanedLines[cleanedLines.length - 1])) {
        cleanedLines.pop();
    }

    // Ajouter une ligne vide finale pour séparer les imports du reste du code
    cleanedLines.push('');

    return cleanedLines;
}

/**
 * Aligne les imports d'un groupe
 */
function alignImportsInGroup(importLines: string[], config: FormatterConfig): string[] {
    // Optimisation: Calculer les indices "from" en une seule passe
    const fromIndices = new Map<string, number>();
    let maxWidth = 0;
    
    for (const line of importLines) {
        const isMultiline = line.includes('\n');
        const fromIndex = getFromIndex(line, isMultiline);
        
        if (fromIndex > 0) {
            fromIndices.set(line, fromIndex);
            maxWidth = Math.max(maxWidth, fromIndex);
        }
    }

    // Aligner tous les "from" du groupe en utilisant la configuration
    return importLines.map((line) => {
        const fromIndex = fromIndices.get(line);
        if (fromIndex !== undefined && !line.includes('\n')) {
            return alignFromKeyword(line, fromIndex, maxWidth, config);
        }
        return line;
    });
}

/**
 * Formate un import selon les règles de formatage (multiligne si plusieurs spécificateurs)
 */
function formatImportLine(importItem: ParsedImport): string {
    const { type, source, specifiers, raw } = importItem;

    // Pour les imports de type side-effect ou sans spécificateurs
    if (type === 'sideEffect' || specifiers.length === 0) {
        return `import '${source}';`;
    }

    // Pour les imports par défaut sans imports nommés
    if (type === 'default' && specifiers.length === 1) {
        return `import ${specifiers[0]} from '${source}';`;
    }

    // Pour les imports de type
    if (type === 'typeDefault' && specifiers.length === 1) {
        return `import type ${specifiers[0]} from '${source}';`;
    }

    // Pour les imports nommés avec un seul spécificateur
    if ((type === 'named' || type === 'typeNamed') && specifiers.length === 1) {
        const typePrefix = type === 'typeNamed' ? 'type ' : '';
        return `import ${typePrefix}{ ${specifiers[0]} } from '${source}';`;
    }

    // Pour les imports nommés avec plusieurs spécificateurs (format multiligne)
    if ((type === 'named' || type === 'typeNamed') && specifiers.length > 1) {
        const typePrefix = type === 'typeNamed' ? 'type ' : '';
        return `import ${typePrefix}{\n    ${specifiers.join(',\n    ')}\n} from '${source}';`;
    }

    // Cas par défaut : retourner l'import brut
    return raw;
}

/**
 * Formate les imports en respectant les groupes et l'ordre fournis par le parser
 */
export function formatImportsFromParser(
    sourceText: string,
    importRange: { start: number; end: number },
    parserResult: ParserResult,
    config: FormatterConfig
): string {
    // Si aucun import trouvé, retourner le texte original
    if (importRange.start === importRange.end || !parserResult.groups.length) {
        return sourceText;
    }

    const formattedGroups: FormattedImportGroup[] = [];
    
    // Traiter chaque groupe d'imports (trier par ordre pour respecter la configuration)
    const sortedGroups = [...parserResult.groups].sort((a, b) => a.order - b.order);
    
    for (const group of sortedGroups) {
        if (!group.imports.length) continue;
        
        const groupResult: FormattedImportGroup = {
            groupName: group.name,
            commentLine: `// ${group.name}`,
            importLines: []
        };
        
        // Trier les imports dans le groupe: d'abord par isPriority, puis par type
        const sortedImports = [...group.imports].sort((a, b) => {
            // 1. D'abord par isPriority (les imports prioritaires en premier)
            if (a.isPriority && !b.isPriority) return -1;
            if (!a.isPriority && b.isPriority) return 1;
            
            // 2. Ensuite par type (side-effect, default, named, type)
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
        
        // Dédupliquer les imports pour éviter les doublons
        const uniqueImportsBySource = new Map<string, ParsedImport>();
        
        for (const importItem of sortedImports) {
            const key = `${importItem.source}_${importItem.type}`;
            
            if (!uniqueImportsBySource.has(key)) {
                uniqueImportsBySource.set(key, { ...importItem });
            } else {
                // Si on a déjà un import pour cette source et ce type, fusionner les spécificateurs
                const existingImport = uniqueImportsBySource.get(key)!;
                
                // Assurer que les spécificateurs sont uniques
                const uniqueSpecifiers = new Set([
                    ...existingImport.specifiers,
                    ...importItem.specifiers
                ]);
                
                existingImport.specifiers = Array.from(uniqueSpecifiers);
            }
        }
        
        // Formater les imports selon les règles (multiligne pour plusieurs spécificateurs)
        for (const importItem of uniqueImportsBySource.values()) {
            const formattedImport = formatImportLine(importItem);
            groupResult.importLines.push(formattedImport);
        }
        
        formattedGroups.push(groupResult);
    }
    
    // Générer le texte formaté
    const formattedLines: string[] = [];
    
    for (const group of formattedGroups) {
        // Ajouter le commentaire de groupe
        formattedLines.push(group.commentLine);
        
        // Aligner les imports dans le groupe (mais pas les multilignes)
        const alignedImports = alignImportsInGroup(group.importLines, config);
        formattedLines.push(...alignedImports);
        
        // Ajouter une ligne vide après chaque groupe
        formattedLines.push('');
    }
    
    // Nettoyer les lignes (supprimer les lignes vides consécutives, etc.)
    const cleanedLines = cleanUpLines(formattedLines);
    const formattedText = cleanedLines.join('\n');
    
    // Remplacer la section d'imports dans le texte original
    return (
        sourceText.substring(0, importRange.start) +
        formattedText +
        sourceText.substring(importRange.end)
    );
}

/**
 * Trouve la plage des imports dans le texte source
 */
function findImportsRange(text: string): { start: number; end: number } {
    // Regex pour trouver les lignes d'import
    const importRegex = /^import\s+.+?;|^\/\/\s*[\w\s@/]+$/gm;

    let firstStart = text.length;
    let lastEnd = 0;
    let match;

    // Trouver tous les imports et commentaires de section
    while ((match = importRegex.exec(text)) !== null) {
        firstStart = Math.min(firstStart, match.index);
        lastEnd = Math.max(lastEnd, match.index + match[0].length);
    }

    // Si aucun import n'est trouvé, retourner une plage vide
    if (firstStart === text.length) {
        return { start: 0, end: 0 };
    }

    // Rechercher plus loin pour les imports multilignes
    const lines = text.split('\n');
    let startLine = -1;
    let endLine = -1;
    let inMultilineImport = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Détecter le début d'un import
        if (line.startsWith('import ')) {
            if (startLine === -1) {
                startLine = i;
            }
            
            // Vérifier si c'est un import multiligne
            if (line.includes('{') && !line.includes('}') && !line.endsWith(';')) {
                inMultilineImport = true;
            } else if (line.endsWith(';')) {
                endLine = i;
                inMultilineImport = false;
            }
        }
        // Pour les lignes d'un import multiligne
        else if (inMultilineImport) {
            if (line.includes('}') && line.endsWith(';')) {
                endLine = i;
                inMultilineImport = false;
            }
        }
        // Pour les commentaires de section
        else if (line.startsWith('//')) {
            if (startLine === -1) {
                startLine = i;
            }
            endLine = i;
        }
        // Si on a déjà trouvé des imports et qu'on rencontre une ligne non-import
        else if (startLine !== -1 && !line.trim() && !inMultilineImport) {
            // Ne rien faire, ignorer les lignes vides
        }
        // Si on rencontre du code après avoir trouvé des imports
        else if (startLine !== -1 && line.trim() && !inMultilineImport) {
            break;
        }
    }
    
    // Calculer les positions de début et de fin
    if (startLine !== -1 && endLine !== -1) {
        const startPos = lines.slice(0, startLine).join('\n').length + (startLine > 0 ? 1 : 0);
        const endPos = lines.slice(0, endLine + 1).join('\n').length;
        
        // Ajuster en fonction de ce qu'on a trouvé précédemment
        firstStart = Math.min(firstStart, startPos);
        lastEnd = Math.max(lastEnd, endPos);
    }

    // Ajuster la fin pour inclure les lignes vides suivantes
    const remainingText = text.substring(lastEnd);
    const remainingLines = remainingText.split('\n');
    let additionalLines = 0;
    
    for (const line of remainingLines) {
        if (line.trim() === '') {
            additionalLines += line.length + 1; // +1 pour le saut de ligne
        } else {
            break;
        }
    }

    return { 
        start: firstStart, 
        end: lastEnd + additionalLines 
    };
}

/**
 * Point d'entrée principal pour le formatage des imports
 */
export function formatImports(
    sourceText: string, 
    config: FormatterConfig,
    parserResult?: ParserResult
): string {
    // Trouver la plage des imports dans le texte source
    const importRange = findImportsRange(sourceText);
    
    // Si aucun import n'est trouvé, retourner le texte original
    if (importRange.start === importRange.end) {
        return sourceText;
    }
    
    // Si aucun résultat de parser n'est fourni, retourner le texte original
    if (!parserResult) {
        logDebug('Aucun résultat de parser fourni, impossible de formater les imports');
        return sourceText;
    }
    
    // Formater les imports
    return formatImportsFromParser(sourceText, importRange, parserResult, config);
}