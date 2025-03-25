// Misc
import {
    ImportGroup,
    FormatterConfig
}                   from '../types';
import {
  TypeOrder,
  ParserConfig
}              from 'tidyjs-parser';
// VSCode
import vscode from 'vscode';

export interface ConfigChangeEvent {
  configKey: string;
  newValue: unknown;
}

const DEFAULT_FORMATTER_CONFIG: FormatterConfig = {
  importGroups: [
    { name: 'Misc', order: 0, isDefault: true, regex: /^(react|react-.*|lodash|date-fns|classnames|@fortawesome|@reach|uuid|@tanstack|ag-grid-community|framer-motion)$/ },
    { name: 'DS', order: 1, regex: /^ds$/ },
    { name: '@core', order: 3, regex: /^@core/ },
    { name: '@library', order: 4, regex: /^@library/ },
    { name: 'Utils', order: 5, regex: /^yutils/ },
  ],
  formatOnSave: false,
  typeOrder: {
    default: 0,    
    named: 1,      
    typeDefault: 2,
    typeNamed: 3,  
    sideEffect: 4  
  },
  sectionComment: /^\s*\/\/\s*(?:Misc|DS|@app(?:\/[a-zA-Z0-9_-]+)?|@core|@library|Utils|.*\b(?:misc|ds|dossier|client|notification|core|library|utils)\b.*)\s*$/gim,
  patterns: {
    subfolderPattern: /^@app\/([a-zA-Z0-9_-]+)/
  },
};

class ConfigManager {
  private config: FormatterConfig;
  private eventEmitter: vscode.EventEmitter<ConfigChangeEvent> = new vscode.EventEmitter<ConfigChangeEvent>();
  private appSubfolders: Map<string, ImportGroup> = new Map();

  public readonly onDidConfigChange: vscode.Event<ConfigChangeEvent> = this.eventEmitter.event;

  constructor() {
    this.config = { ...DEFAULT_FORMATTER_CONFIG };
    this.loadConfiguration();
  }

  public getConfig(): FormatterConfig {
    return this.config;
  }

  public getImportGroups(): ImportGroup[] {
    const baseGroups = [...this.config.importGroups];
    const appSubfolderGroups = Array.from(this.appSubfolders.values());

    const sortedGroups = [...baseGroups, ...appSubfolderGroups].sort((a, b) => {
      if (a.name === 'Misc') return -1;
      if (b.name === 'Misc') return 1;
      if (a.name === 'DS') return -1;
      if (b.name === 'DS') return 1;

      const aIsApp = a.name.startsWith('@app');
      const bIsApp = b.name.startsWith('@app');

      if (aIsApp && !bIsApp) return -1;
      if (!aIsApp && bIsApp) return 1;

      if (aIsApp && bIsApp) {
        if (a.name === '@app') return 1;
        if (b.name === '@app') return -1;
        return a.name.localeCompare(b.name);
      }

      return a.order - b.order;
    });

    return sortedGroups;
  }

  public getRegexPatterns() {
    return {
      sectionComment: this.config.sectionComment,
      subfolderPattern: this.config.patterns?.subfolderPattern
    };
  }

  public registerAppSubfolder(subfolder: string): void {
    if (subfolder && !this.appSubfolders.has(subfolder)) {
      const order = 2;
      const name = `@app/${subfolder}`;
      const regex = new RegExp(`^@app\\/${subfolder}`);

      this.appSubfolders.set(subfolder, {
        name,
        regex,
        order,
        isDefault: false
      });
    }
  }

  public loadConfiguration(): void {
    const vsConfig = vscode.workspace.getConfiguration('tidyjs');

    const customGroups = vsConfig.get<Array<{ name: string; regex: string; order: number; isDefault?: boolean }>>('groups');
    if (customGroups && customGroups.length > 0) {
      this.config.importGroups = customGroups.map((group) => {
        const regexStr = group.regex || '';
        let pattern: string;
        let flags = '';

        if (regexStr && regexStr.startsWith('/') && regexStr.length > 2) {
          const lastSlashIndex = regexStr.lastIndexOf('/');
          if (lastSlashIndex > 0) {
            pattern = regexStr.slice(1, lastSlashIndex);
            flags = regexStr.slice(lastSlashIndex + 1);

            const validFlags = flags.split('').every(flag => 'gimsuy'.includes(flag));
            if (!validFlags) {
              throw new Error(`Invalid regex flags in pattern: ${regexStr}. Valid flags are: g, i, m, s, u, y`);
            }
          } else {
            pattern = regexStr;
          }
        } else {
          pattern = regexStr;
        }

        return {
          name: group.name,
          regex: new RegExp(pattern, flags),
          order: group.order,
          isDefault: group.isDefault || false,
        };
      });
      this.eventEmitter.fire({ configKey: 'importGroups', newValue: this.config.importGroups });
    }
    const formatOnSave = vsConfig.get<boolean>('formatOnSave');
    if (typeof formatOnSave === 'boolean') {
      this.config.formatOnSave = formatOnSave;
      this.eventEmitter.fire({ configKey: 'formatOnSave', newValue: formatOnSave });
    }

    const typeOrder = vsConfig.get<TypeOrder>('typeOrder');
    if (typeOrder) {
      this.config.typeOrder = typeOrder;
      this.eventEmitter.fire({ configKey: 'typeOrder', newValue: typeOrder });
    }
  }

  public getFormatOnSave(): boolean {
    return this.config.formatOnSave;
  }

  public getFormatterConfig(): FormatterConfig {
    return {
      importGroups: this.getImportGroups(),
      formatOnSave: this.config.formatOnSave,
      typeOrder: this.config.typeOrder,
      sectionComment: this.config.sectionComment,
      patterns: this.config.patterns
    };
  }

  /**
   * Convertit la configuration du formateur en configuration du parser
   */
  public getParserConfig(): ParserConfig {
    const validGroups = this.getImportGroups().filter(group => group.regex);
    
    return {
      typeOrder: this.config.typeOrder,
      patterns: {
        subfolderPattern: this.config.patterns?.subfolderPattern
      },
      importGroups: validGroups
    };
  }
}

export const configManager = new ConfigManager();

export const DEFAULT_IMPORT_GROUPS: ImportGroup[] = configManager.getImportGroups();
