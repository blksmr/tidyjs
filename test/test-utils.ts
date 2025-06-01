import { ImportSpecifier } from '../src/parser';

/**
 * Utility function to check if a specifier (string or alias object) contains a specific import name
 */
export function containsSpecifier(specifiers: ImportSpecifier[], importName: string): boolean {
  return specifiers.some(spec => {
    if (typeof spec === 'string') {
      return spec === importName;
    } else {
      return spec.imported === importName;
    }
  });
}

/**
 * Utility function to extract all import names from specifiers (both strings and alias objects)
 */
export function extractImportNames(specifiers: ImportSpecifier[]): string[] {
  return specifiers.map(spec => {
    if (typeof spec === 'string') {
      return spec;
    } else {
      return spec.imported;
    }
  });
}

/**
 * Utility function to extract all local names from specifiers (both strings and alias objects)
 */
export function extractLocalNames(specifiers: ImportSpecifier[]): string[] {
  return specifiers.map(spec => {
    if (typeof spec === 'string') {
      return spec;
    } else {
      return spec.local;
    }
  });
}