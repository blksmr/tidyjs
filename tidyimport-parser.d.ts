declare module 'tidyimport-parser' {
  interface ImportParserConfig {
    defaultGroupName?: string;
    typeOrder?: {
      sideEffect: number;
      default: number;
      named: number;
      typeDefault: number;
      typeNamed: number;
    };
    TypeOrder?: {
      default: number;
      named: number;
      typeDefault: number;
      typeNamed: number;
      sideEffect: number;
    };
    patterns?: {
      appSubfolderPattern: string | RegExp;
    };
    importGroups?: Array<{
      name: string;
      regex: RegExp;
      order: number;
      isDefault?: boolean;
    }>;
    priorityImports?: Array<unknown>;
  }

  export class ImportParser {
    constructor(config?: ImportParserConfig);
    parse(code: string): unknown;
  }
}
