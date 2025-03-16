import { FormatterConfig } from '../types';

// Helper : Function to sort import names alphabetically and then by length (longest first)
export function sortImportNamesByLength(names: string[]): string[] {
    return [...names].sort((a, b) => {
        // Extract actual name without 'type' keyword for comparison
        const aName = a.startsWith('type ') ? a.substring(5) : a;
        const bName = b.startsWith('type ') ? b.substring(5) : b;
        
        // First sort alphabetically
        const alphabeticalCompare = aName.localeCompare(bName);
        if (alphabeticalCompare !== 0) {
            return alphabeticalCompare;
        }
        
        // Then sort by length (longest first)
        return bName.length - aName.length;
    });
}

// Helper function to get the index of the 'from' keyword in an import statement
export function getFromIndex(line: string, isMultiline: boolean = false): number {
    if (isMultiline) {
        const lines = line.split('\n');
        const lastLine = lines[lines.length - 1];
        const fromIndex = lastLine.indexOf('from');
        return fromIndex > 0 ? fromIndex : -1;
    } else {
        const fromIndex = line.indexOf('from');
        return fromIndex > 0 ? fromIndex : -1;
    }
}

// Helper : Function to align imports
export function alignFromKeyword(
    line: string, 
    fromIndex: number, 
    maxWidth: number, 
    spacingWidth: number
): string {
    if (fromIndex <= 0) return line;
    
    const padding = ' '.repeat(maxWidth - fromIndex + spacingWidth);
    
    if (line.includes('\n')) {
        const lines = line.split('\n');
        const lastLineIndex = lines.length - 1;
        const lastLine = lines[lastLineIndex];
        
        lines[lastLineIndex] = 
            lastLine.substring(0, fromIndex) +
            padding +
            'from' +
            lastLine.substring(fromIndex + 4);
        
        return lines.join('\n');
    } else {
        return (
            line.substring(0, fromIndex) +
            padding +
            'from' +
            line.substring(fromIndex + 4)
        );
    }
}

// Helper: Vérifie si une ligne est vide
export function isEmptyLine(line: string): boolean {
    return line.trim() === '';
}

// Helper: Vérifie si une ligne est un commentaire
export function isCommentLine(line: string): boolean {
    return line.trim().startsWith('//');
}

// Helper: Vérifie si une ligne est un commentaire de section
export function isSectionComment(line: string, config: FormatterConfig): boolean {
    return config.regexPatterns.sectionCommentPattern.test(line);
}

// Helper: Vérifie si une ligne est une section de commentaire
export function formatSimpleImport(moduleName: string): string {
    return `import '${moduleName}';`;
}
