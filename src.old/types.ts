import * as vscode from 'vscode';

export interface ImportGroup {
    name: string;
    regex: RegExp;
    order: number;
}

export interface ImportNode {
    text: string;
    defaultImport: string | null;
    namedImports: string[];
    typeImports: string[];
    source: string;
    isTypeOnly: boolean;
    originalText: string;
    range: vscode.Range;
    group: string;
}

export interface ImportNameWithComment {
    name: string;
    comment?: string;
}

export interface FormattedImport {
    statement: string;
    group: ImportGroup;
    moduleName: string;
    importNames: string[];
    isTypeImport: boolean;
    isDefaultImport: boolean;
    hasNamedImports: boolean;
}

export interface FormattedImportGroup {
    groupName: string;
    commentLine: string;
    importLines: string[];
}

export interface FormatterConfig {
    importGroups: ImportGroup[];
    alignmentSpacing: number;
    regexPatterns: {
        importLine: RegExp;
        appSubfolderPattern: RegExp;
        sectionComment: RegExp;
        importFragment: RegExp;
        sectionCommentPattern: RegExp;
        anyComment: RegExp;
        codeDeclaration: RegExp;
        typeDeclaration: RegExp;
        orphanedFragments: RegExp;
        possibleCommentFragment: RegExp;
    };
    formatOnSave: boolean;
    maxLineLength: number;
}