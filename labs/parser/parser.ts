import { validateAndFixImportWithBabel } from './fixer';
import { ImportParserError } from './errors';
import {
  ParserConfig,
  ParsedImport,
  ImportGroup,
  TypeOrder,
  SourcePatterns,
  InvalidImport,
  DEFAULT_CONFIG
} from './types';

class ImportParser {
  private readonly config: ParserConfig;
  private readonly defaultGroupName: string;
  private readonly typeOrder: TypeOrder;
  private readonly TypeOrder: TypeOrder;
  private readonly patterns: SourcePatterns;
  private readonly priorityImportPatterns: RegExp[];

  private appSubfolders: Set<string>;

  constructor(config: ParserConfig) {

    this.config = {
      ...config,
      typeOrder: { ...(DEFAULT_CONFIG.typeOrder as TypeOrder), ...(config.typeOrder || {}) } as TypeOrder,
      TypeOrder: { ...(DEFAULT_CONFIG.TypeOrder as TypeOrder), ...(config.TypeOrder || {}) } as TypeOrder,
      patterns: { ...DEFAULT_CONFIG.patterns, ...config.patterns }
    };

    this.appSubfolders = new Set<string>();


    if (config.defaultGroupName) {
      this.defaultGroupName = config.defaultGroupName;
    } else {
      const defaultGroup = config.importGroups.find(g => g.isDefault);
      this.defaultGroupName = defaultGroup ? defaultGroup.name : 'Misc';
    }

    this.typeOrder = this.config.typeOrder as TypeOrder;
    this.TypeOrder = this.config.TypeOrder as TypeOrder;
    this.patterns = this.config.patterns as SourcePatterns;
    this.priorityImportPatterns = this.config.priorityImports || [];
  }


  public parse(sourceCode: string): {
    groups: ImportGroup[];
    originalImports: string[];
    invalidImports: InvalidImport[];
  } {


    const importRegex = /^\s*import\s+(?:(?:type\s+)?(?:{[^;]*}|\*\s*as\s*\w+|\w+)?(?:\s*,\s*(?:{[^;]*}|\*\s*as\s*\w+|\w+))?(?:\s*from)?\s*['"]?[^'";]+['"]?;?|['"][^'"]+['"];?)/gm;

    const originalImports: string[] = [];
    const invalidImports: InvalidImport[] = [];


    const potentialImportLines: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = importRegex.exec(sourceCode)) !== null) {

      const lineStart = sourceCode.lastIndexOf('\n', match.index) + 1;
      let lineEnd = sourceCode.indexOf('\n', match.index);
      if (lineEnd === -1) lineEnd = sourceCode.length;


      let importStmt = sourceCode.substring(match.index, lineEnd).trim();


      if (!importStmt.includes(';')) {
        let searchEnd = lineEnd;
        let nextLine = '';


        do {
          const nextLineStart = searchEnd + 1;
          searchEnd = sourceCode.indexOf('\n', nextLineStart);
          if (searchEnd === -1) searchEnd = sourceCode.length;

          nextLine = sourceCode.substring(nextLineStart, searchEnd).trim();


          if (nextLine && !nextLine.startsWith('import') && !nextLine.startsWith('//')) {
            importStmt += '\n' + nextLine;
          }

        } while (!importStmt.includes(';') && nextLine && !nextLine.startsWith('import') && searchEnd < sourceCode.length);
      }


      const trimmedImport = importStmt.trim();
      if (trimmedImport) {
        potentialImportLines.push(trimmedImport);
      }
    }


    let parsedImports: ParsedImport[] = [];

    for (const importStmt of potentialImportLines) {
      try {

        originalImports.push(importStmt);


        const { fixed, isValid, error } = validateAndFixImportWithBabel(importStmt);

        if (!isValid) {

          let errorMessage = error || "Erreur de syntaxe non spécifiée";


          if (error?.includes("Unexpected token, expected \"from\"")) {
            if (importStmt.includes(" as ")) { errorMessage += " - Lors de l'utilisation d'un alias avec 'as', il faut l'inclure à l'intérieur des accolades pour les imports nommés ou l'utiliser avec un import par défaut. Exemple correct: import { Component as C } from 'module'; ou import Default as D from 'module';"; }
          }

          invalidImports.push({
            raw: importStmt, error: errorMessage
          });
          continue;
        }


        const normalizedImport = fixed || importStmt;


        const imports = this.parseImport(normalizedImport);


        if (Array.isArray(imports)) {
          parsedImports = parsedImports.concat(imports);
        } else {
          parsedImports.push(imports);
        }
      } catch (error) {

        invalidImports.push({
          raw: importStmt,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }


    parsedImports = this.mergeImports(parsedImports);


    const groups = this.organizeImportsIntoGroups(parsedImports);

    return { groups, originalImports, invalidImports };
  }


  private parseImport(importStmt: string): ParsedImport | ParsedImport[] {
    try {

      const isTypeImport = importStmt.includes('import type');
      const isSideEffect = !importStmt.includes(' from ');


      const sourceMatch = importStmt.match(/from\s+['"]([^'"]+)['"]/);
      const source = sourceMatch ? sourceMatch[1] : importStmt.match(/import\s+['"]([^'"]+)['"]/)?.[1] ?? '';


      if (!source) {
        throw new ImportParserError(
          `Impossible d'extraire la source du module d'import`,
          importStmt
        );
      }


      const isPriority = this.isSourcePriority(source);


      const groupName = this.determineGroupName(source);


      let appSubfolder: string | null = null;

      if (this.patterns.appSubfolderPattern) {
        const appSubfolderMatch = source.match(this.patterns.appSubfolderPattern);
        if (appSubfolderMatch?.[1]) {
          appSubfolder = appSubfolderMatch[1];
          this.appSubfolders.add(appSubfolder);
        }
      }


      let type: 'default' | 'named' | 'typeDefault' | 'typeNamed' | 'sideEffect' = 'default';
      let specifiers: string[] = [];

      if (isSideEffect) {
        type = 'sideEffect';
      } else if (isTypeImport) {
        if (importStmt.includes('{')) {
          type = 'typeNamed';
          const namedMatch = importStmt.match(/import\s+type\s+{([^}]+)}/);
          if (namedMatch) {
            specifiers = namedMatch[1].split(',').map(s => s.trim()).filter(s => s !== '');
          }
        } else {
          type = 'typeDefault';
          const defaultMatch = importStmt.match(/import\s+type\s+(\w+|\*\s+as\s+\w+)/);
          if (defaultMatch) {
            specifiers = [defaultMatch[1]];
          }
        }
      } else if (importStmt.includes('{')) {
        type = 'named';
        const namedMatch = importStmt.match(/import\s+(?:\w+\s*,\s*)?{([^}]+)}/);


        const defaultWithNamedMatch = importStmt.match(/import\s+(\w+|\*\s+as\s+\w+)\s*,\s*{/);
        const defaultSpecifier = defaultWithNamedMatch ? defaultWithNamedMatch[1] : null;

        if (namedMatch) {

          const rawSpecifiers = namedMatch[1].split(/,|\n/).map(s => s.trim()).filter(s => s !== '');


          const regularSpecifiers: string[] = [];
          const typeSpecifiers: string[] = [];

          for (const spec of rawSpecifiers) {
            if (spec.startsWith('type ')) { typeSpecifiers.push(spec.substring(5).trim()); } else { regularSpecifiers.push(spec); }
          }


          const deduplicatedRegularSpecifiers = this.deduplicateSpecifiers(regularSpecifiers);


          if (typeSpecifiers.length > 0) {
            const result: ParsedImport[] = [];
            if (defaultSpecifier) { result.push({ type: 'default', source, specifiers: [defaultSpecifier], raw: importStmt, groupName, isPriority, appSubfolder }); }
            if (deduplicatedRegularSpecifiers.length > 0) { result.push({ type: 'named', source, specifiers: deduplicatedRegularSpecifiers, raw: importStmt, groupName, isPriority, appSubfolder }); }
            const deduplicatedTypeSpecifiers = this.deduplicateSpecifiers(typeSpecifiers); result.push({ type: 'typeNamed', source, specifiers: deduplicatedTypeSpecifiers, raw: importStmt, groupName, isPriority, appSubfolder });
            return result;
          }


          specifiers = deduplicatedRegularSpecifiers;


          if (defaultSpecifier) {
            type = 'default'; specifiers.unshift(defaultSpecifier);
          }
        }
      } else if (importStmt.includes('* as ')) {

        const namespaceMatch = importStmt.match(/import\s+\*\s+as\s+(\w+)/);
        if (namespaceMatch) {
          type = 'default';
          specifiers = [namespaceMatch[1]];
        }
      } else {
        type = 'default';
        const defaultMatch = importStmt.match(/import\s+(\w+|\*\s+as\s+\w+)/);
        if (defaultMatch) {
          specifiers = [defaultMatch[1]];
        }
      }

      if (!isSideEffect && specifiers.length === 0) {
        throw new ImportParserError(
          `Aucun spécificateur trouvé dans l'import`,
          importStmt
        );
      }

      return {
        type,
        source,
        specifiers,
        raw: importStmt,
        groupName,
        isPriority,
        appSubfolder
      };
    } catch (error) {

      if (error instanceof ImportParserError) {
        throw error;
      }


      throw new ImportParserError(
        `Erreur lors du parsing de l'import: ${error instanceof Error ? error.message : String(error)}`,
        importStmt
      );
    }
  }


  private deduplicateSpecifiers(specifiers: string[]): string[] {

    const uniqueSpecs = new Map<string, string>();

    for (const spec of specifiers) {

      const isTypeSpec = spec.startsWith('type ');
      const specWithoutType = isTypeSpec ? spec.substring(5).trim() : spec;


      let baseSpecName: string;
      let fullSpec = spec;

      if (specWithoutType.includes(' as ')) {
        const [baseName, _] = specWithoutType.split(' as ');
        baseSpecName = baseName.trim();
      } else {
        baseSpecName = specWithoutType;
      }


      const uniqueKey = (isTypeSpec ? 'type_' : '') + baseSpecName;


      if (!uniqueSpecs.has(uniqueKey)) {
        uniqueSpecs.set(uniqueKey, fullSpec);
      }
    }


    return Array.from(uniqueSpecs.values());
  }


  private preprocessImport(importStmt: string): string {

    if (!importStmt.includes('{')) {
      return importStmt;
    }

    try {

      const importMatch = importStmt.match(/^(import\s+(?:type\s+)?)({[^}]*})(\s+from\s+.+)$/);
      if (!importMatch) {
        return importStmt;
      }

      const [_, prefix, specifiersBlock, suffix] = importMatch;


      const specifiersContent = specifiersBlock.substring(1, specifiersBlock.length - 1);
      const specifiers = specifiersContent.split(',').map(s => s.trim()).filter(Boolean);


      const uniqueSpecifiers = this.deduplicateSpecifiers(specifiers);


      const correctedSpecifiers = uniqueSpecifiers.join(', ');
      return `${prefix}{${correctedSpecifiers}}${suffix}`;
    } catch (error) {

      return importStmt;
    }
  }


  private isSourcePriority(source: string): boolean {

    if (this.priorityImportPatterns.length > 0) {
      return this.priorityImportPatterns.some(pattern => pattern.test(source));
    }


    const defaultGroup = this.config.importGroups.find(group => group.isDefault);
    if (defaultGroup) {


      const regexStr = defaultGroup.regex.toString();
      const match = regexStr.match(/\(\s*([^|)]+)/);
      if (match && match[1]) {

        const firstPattern = match[1].replace(/[^a-zA-Z0-9\-_]/g, '');

        return new RegExp(`^${firstPattern}`).test(source);
      }
    }


    return false;
  }


  private cleanImportStatement(importStmt: string): string {

    const lines = importStmt.split('\n');


    const cleanedLines: string[] = [];

    for (const line of lines) {

      if (line.trim().startsWith('//')) {
        continue;
      }


      const cleanedLine = line.replace(/\/\/.*$/, '').trim();
      if (cleanedLine) {
        cleanedLines.push(cleanedLine);
      }
    }


    let cleaned = cleanedLines.join(' ').trim();


    if (!cleaned.endsWith(';')) {
      cleaned += ';';
    }

    return cleaned;
  }


  private mergeImports(imports: ParsedImport[]): ParsedImport[] {

    const mergedImportsMap = new Map<string, ParsedImport>();

    for (const importObj of imports) {

      const cleanedRaw = this.cleanImportStatement(importObj.raw);


      const key = `${importObj.type}:${importObj.source}`;

      if (mergedImportsMap.has(key)) {

        const existingImport = mergedImportsMap.get(key)!;


        const specifiersSet = new Set<string>([
          ...existingImport.specifiers,
          ...importObj.specifiers
        ]);


        existingImport.specifiers = Array.from(specifiersSet).sort();



        if (cleanedRaw.length > this.cleanImportStatement(existingImport.raw).length) {
          existingImport.raw = cleanedRaw;
        }


        this.validateSpecifiersConsistency(existingImport);
      } else {

        const newImport = {
          ...importObj,
          raw: cleanedRaw,

          specifiers: [...importObj.specifiers].sort()
        };


        this.validateSpecifiersConsistency(newImport);

        mergedImportsMap.set(key, newImport);
      }
    }


    return Array.from(mergedImportsMap.values());
  }


  private validateSpecifiersConsistency(importObj: ParsedImport): void {

    if (importObj.type === 'named' || importObj.type === 'typeNamed') {

      let prefix = importObj.type === 'typeNamed' ? 'import type ' : 'import ';
      let specifiersStr = `{ ${importObj.specifiers.join(', ')} }`;
      let reconstructed = `${prefix}${specifiersStr} from '${importObj.source}';`;



      if (!this.areImportsSemanticallyEquivalent(importObj.raw, reconstructed)) {
        importObj.raw = reconstructed;
      }
    }

    else if (importObj.type === 'default' || importObj.type === 'typeDefault') {
      let prefix = importObj.type === 'typeDefault' ? 'import type ' : 'import ';
      let reconstructed = `${prefix}${importObj.specifiers[0]} from '${importObj.source}';`;

      if (!this.areImportsSemanticallyEquivalent(importObj.raw, reconstructed)) {
        importObj.raw = reconstructed;
      }
    }
  }


  private areImportsSemanticallyEquivalent(import1: string, import2: string): boolean {

    const normalize = (str: string) => str.replace(/\s+/g, ' ').trim();


    const extractParts = (importStr: string) => {
      const typeMatch = importStr.includes('import type');
      const sourceMatch = importStr.match(/from\s+['"]([^'"]+)['"]/);
      const source = sourceMatch ? sourceMatch[1] : '';


      const specifiers: string[] = [];
      if (importStr.includes('{')) {
        const specifiersMatch = importStr.match(/{([^}]*)}/);
        if (specifiersMatch) {
          specifiers.push(...specifiersMatch[1].split(',').map(s => s.trim()).filter(Boolean));
        }
      } else if (!importStr.includes('{') && importStr.includes('import')) {
        const defaultMatch = importStr.match(/import\s+(?:type\s+)?(\w+|\*\s+as\s+\w+)/);
        if (defaultMatch) {
          specifiers.push(defaultMatch[1]);
        }
      }

      return { typeMatch, source, specifiers };
    };

    const parts1 = extractParts(normalize(import1));
    const parts2 = extractParts(normalize(import2));


    return parts1.typeMatch === parts2.typeMatch &&
      parts1.source === parts2.source &&
      JSON.stringify(parts1.specifiers.sort()) === JSON.stringify(parts2.specifiers.sort());
  }


  private determineGroupName(source: string): string {

    for (const group of this.config.importGroups) {
      if (group.regex.test(source)) {
        return group.name;
      }
    }


    return this.defaultGroupName;
  }


  private organizeImportsIntoGroups(imports: ParsedImport[]): ImportGroup[] {
    const groupMap = new Map<string, ParsedImport[]>();
    const appSubfolderGroups = new Map<string, ParsedImport[]>();


    const configGroupMap = new Map<string, number>();
    this.config.importGroups.forEach(group => {
      configGroupMap.set(group.name, group.order);
      groupMap.set(group.name, []);
    });


    if (!groupMap.has(this.defaultGroupName)) {
      const defaultOrder = 999;
      groupMap.set(this.defaultGroupName, []);
      configGroupMap.set(this.defaultGroupName, defaultOrder);
    }


    imports.forEach(importObj => {

      if (importObj.appSubfolder) {
        const subfolder = importObj.appSubfolder;
        const groupName = `@app/${subfolder}`;

        if (!appSubfolderGroups.has(groupName)) {
          appSubfolderGroups.set(groupName, []);
        }

        appSubfolderGroups.get(groupName)!.push(importObj);
      }

      else if (importObj.groupName && groupMap.has(importObj.groupName)) {
        groupMap.get(importObj.groupName)!.push(importObj);
      }

      else {
        groupMap.get(this.defaultGroupName)!.push(importObj);
      }
    });


    groupMap.forEach((importsInGroup, groupName) => {
      groupMap.set(groupName, this.sortImportsWithinGroup(importsInGroup));
    });


    appSubfolderGroups.forEach((importsInGroup, groupName) => {
      appSubfolderGroups.set(groupName, this.sortImportsWithinGroup(importsInGroup));
    });


    const result: ImportGroup[] = [];


    for (const [name, importsInGroup] of groupMap.entries()) {
      const order = configGroupMap.get(name) ?? 999;
      if (importsInGroup.length > 0) {
        result.push({
          name,
          order,
          imports: importsInGroup
        });
      }
    }


    const appGroup = this.config.importGroups.find(g => g.regex.toString().includes('@app'));
    const appGroupOrder = appGroup ? appGroup.order : 2;

    const sortedSubfolders = Array.from(appSubfolderGroups.keys()).sort();

    for (const subfolderName of sortedSubfolders) {
      const subfolderImports = appSubfolderGroups.get(subfolderName)!;
      if (subfolderImports.length > 0) {
        result.push({
          name: subfolderName,
          order: appGroupOrder,
          imports: subfolderImports
        });
      }
    }


    return result.sort((a, b) => {

      if (a.order === b.order) {
        return a.name.localeCompare(b.name);
      }
      return a.order - b.order;
    });
  }


  private sortImportsWithinGroup(imports: ParsedImport[]): ParsedImport[] {
    return imports.sort((a, b) => {

      if (a.isPriority && !b.isPriority) return -1;
      if (!a.isPriority && b.isPriority) return 1;


      if (a.isPriority && b.isPriority) {
        if (a.type !== b.type) {
          return this.TypeOrder[a.type] - this.TypeOrder[b.type];
        }
      }


      if (a.type !== b.type) {
        return this.typeOrder[a.type] - this.typeOrder[b.type];
      }


      return a.source.localeCompare(b.source);
    });
  }


  public getAppSubfolders(): string[] {
    return Array.from(this.appSubfolders).sort();
  }
}

export { ImportParser };
