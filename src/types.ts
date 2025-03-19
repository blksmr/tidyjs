
export interface ImportGroup {
    name: string;
    regex: RegExp;
    order: number;
}

export interface FormatterConfig {
    alignmentSpacing: number;
    importGroups: ImportGroup[];
    formatOnSave: boolean;
    maxLineLength: number;
    regexPatterns: {
        importLine: RegExp;
        sectionComment: RegExp;
        importFragment: RegExp;
        anyComment: RegExp;
        typeDeclaration: RegExp;
        codeDeclaration: RegExp;
        appSubfolderPattern: RegExp;
    };
}


export interface FormattedImportGroup {
    groupName: string;
    commentLine: string;
    importLines: string[];
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
