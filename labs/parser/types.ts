export type ConfigImportGroup = {
  name: string;
  regex: RegExp;
  order: number;
  isDefault?: boolean;
};

export type ImportType = 'default' | 'named' | 'typeDefault' | 'typeNamed' | 'sideEffect';
export type ImportSource = string;
export type ImportSpecifier = string;

export type TypeOrder = {
  [key in ImportType]: number;
};

export type SourcePatterns = {
  appSubfolderPattern?: RegExp;
};

export type ParserConfig = {
  importGroups: ConfigImportGroup[];
  defaultGroupName?: string;
  typeOrder?: TypeOrder;
  TypeOrder?: TypeOrder;
  patterns?: SourcePatterns;
  priorityImports?: RegExp[];
};
export interface ParsedImport {
  type: ImportType;
  source: ImportSource;
  specifiers: ImportSpecifier[];
  raw: string;
  groupName: string | null;
  isPriority: boolean;
  appSubfolder: string | null;
}

export interface ImportGroup {
  name: string;
  order: number;
  imports: ParsedImport[];
}

export interface InvalidImport {
  raw: string;
  error: string;
}

export interface ParserResult {
  groups: ImportGroup[];
  originalImports: string[];
  appSubfolders: string[];
  invalidImports?: InvalidImport[];
}

export const DEFAULT_CONFIG: Partial<ParserConfig> = {
  defaultGroupName: 'Misc',
  typeOrder: {
    'sideEffect': 0,
    'default': 1,
    'named': 2,
    'typeDefault': 3,
    'typeNamed': 4
  },
  TypeOrder: {
    'default': 0,
    'named': 1,
    'typeDefault': 2,
    'typeNamed': 3,
    'sideEffect': 4
  },
  patterns: {
    appSubfolderPattern: /@app\/([^/]+)/
  }
};
