import { TypeOrder } from 'tidyjs-parser';

export type ImportGroup = {
  name: string;
  order: number;
  priority?: number;
} & (
  | {
      isDefault: true;
      regex?: RegExp;
    }
  | {
      isDefault?: false;
      regex: RegExp;
    }
);

export interface FormatterConfig {
  importGroups: ImportGroup[];
  formatOnSave: boolean;
  typeOrder?: TypeOrder;
  sectionComment?: RegExp;
  patterns?: {
    subfolderPattern?: RegExp;
  };
}

export interface FormattedImportGroup {
  groupName: string;
  commentLine: string;
  importLines: string[];
}
