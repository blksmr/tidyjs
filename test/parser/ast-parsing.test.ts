import { ImportParser } from '../../src/parser';
import { Config } from '../../src/types';

describe('ImportParser - AST Parsing Specifics', () => {
  const basicConfig: Config = {
    groups: [
      {
        name: 'Default',
        order: 1,
        isDefault: true
      }
    ],
    importOrder: {
      default: 1,
      named: 2,
      typeOnly: 3,
      sideEffect: 0
    },
    format: {
      onSave: true
    }
  };

  let parser: ImportParser;

  beforeEach(() => {
    parser = new ImportParser(basicConfig);
  });

  test('should correctly parse AST nodes for default imports', () => {
    const sourceCode = 'import DefaultComponent from "react";';
    const result = parser.parse(sourceCode);

    expect(result.groups).toHaveLength(1);
    const importItem = result.groups[0].imports[0];
    
    expect(importItem.type).toBe('default');
    expect(importItem.defaultImport).toBe('DefaultComponent');
    expect(importItem.specifiers).toContain('DefaultComponent');
    expect(importItem.source).toBe('react');
  });

  test('should correctly identify ImportDefaultSpecifier nodes', () => {
    const sourceCode = `
      import React from "react";
      import Vue from "vue";
      import Component from "./Component";
    `;
    
    const result = parser.parse(sourceCode);
    
    expect(result.groups[0].imports).toHaveLength(3);
    result.groups[0].imports.forEach(imp => {
      expect(imp.type).toBe('default');
      expect(imp.defaultImport).toBeDefined();
      expect(imp.specifiers).toHaveLength(1);
    });
  });

  test('should correctly identify ImportSpecifier nodes', () => {
    const sourceCode = `
      import { useState } from "react";
      import { mount, shallow } from "enzyme";
      import { debounce, throttle } from "lodash";
    `;
    
    const result = parser.parse(sourceCode);
    
    expect(result.groups[0].imports).toHaveLength(3);
    
    expect(result.groups[0].imports[0].specifiers).toEqual(['useState']);
    expect(result.groups[0].imports[1].specifiers).toEqual(['mount', 'shallow']);
    expect(result.groups[0].imports[2].specifiers).toEqual(['debounce', 'throttle']);
    
    result.groups[0].imports.forEach(imp => {
      expect(imp.type).toBe('named');
      expect(imp.defaultImport).toBeUndefined();
    });
  });

  test('should correctly identify ImportNamespaceSpecifier nodes', () => {
    const sourceCode = `
      import * as React from "react";
      import * as Utils from "./utils";
      import * as API from "../api";
    `;
    
    const result = parser.parse(sourceCode);
    
    expect(result.groups[0].imports).toHaveLength(3);
    
    expect(result.groups[0].imports[0].specifiers).toContain('* as React');
    expect(result.groups[0].imports[1].specifiers).toContain('* as Utils');
    expect(result.groups[0].imports[2].specifiers).toContain('* as API');
    
    result.groups[0].imports.forEach(imp => {
      expect(imp.type).toBe('default'); // Namespace imports are treated as default
      expect(imp.specifiers).toHaveLength(1);
    });
  });

  test('should handle complex mixed ImportDeclaration nodes', () => {
    const sourceCode = 'import React, { Component, Fragment } from "react";';
    const result = parser.parse(sourceCode);

    expect(result.groups[0].imports).toHaveLength(1);
    const importItem = result.groups[0].imports[0];
    
    expect(importItem.type).toBe('mixed');
    expect(importItem.defaultImport).toBe('React');
    expect(importItem.specifiers).toContain('Component');
    expect(importItem.specifiers).toContain('Fragment');
    expect(importItem.specifiers).toHaveLength(2); // Only named imports in specifiers for mixed
  });

  test('should correctly parse import source values', () => {
    const sourceCode = `
      import module1 from "simple-module";
      import module2 from "@scoped/package";
      import module3 from "./relative/path";
      import module4 from "../parent/path";
      import module5 from "/absolute/path";
      import module6 from "module/with/subpath";
    `;
    
    const result = parser.parse(sourceCode);
    
    expect(result.groups[0].imports).toHaveLength(6);
    
    const sources = result.groups[0].imports.map(imp => imp.source);
    expect(sources).toEqual([
      'simple-module',
      '@scoped/package',
      './relative/path',
      '../parent/path',
      '/absolute/path',
      'module/with/subpath'
    ]);
  });

  test('should handle imports with aliased specifiers', () => {
    const sourceCode = `
      import { Component as ReactComponent } from "react";
      import { default as React } from "react";
      import { useState as state, useEffect as effect } from "react";
    `;
    
    const result = parser.parse(sourceCode);
    
    expect(result.groups[0].imports).toHaveLength(3);
    
    // The parser should extract the imported name, not the alias
    expect(result.groups[0].imports[0].specifiers).toContain('Component');
    expect(result.groups[0].imports[1].specifiers).toContain('default');
    expect(result.groups[0].imports[2].specifiers).toContain('useState');
    expect(result.groups[0].imports[2].specifiers).toContain('useEffect');
  });

  test('should correctly identify side effect imports with no specifiers', () => {
    const sourceCode = `
      import "normalize.css";
      import "./global.styles.css";
      import "polyfill";
    `;
    
    const result = parser.parse(sourceCode);
    
    expect(result.groups[0].imports).toHaveLength(3);
    
    result.groups[0].imports.forEach(imp => {
      expect(imp.type).toBe('sideEffect');
      expect(imp.specifiers).toHaveLength(0);
      expect(imp.defaultImport).toBeUndefined();
    });
    
    const sources = result.groups[0].imports.map(imp => imp.source);
    expect(sources).toEqual(['normalize.css', './global.styles.css', 'polyfill']);
  });

  test('should correctly extract raw import text from AST ranges', () => {
    const sourceCode = `import React from "react";
import { useState } from "react";`;
    
    const result = parser.parse(sourceCode);
    
    expect(result.groups[0].imports).toHaveLength(2);
    expect(result.originalImports).toHaveLength(2);
    
    expect(result.groups[0].imports[0].raw).toMatch(/import React from "react"/);
    expect(result.groups[0].imports[1].raw).toMatch(/import \{ useState \} from "react"/);
    
    expect(result.originalImports[0]).toMatch(/import React from "react"/);
    expect(result.originalImports[1]).toMatch(/import \{ useState \} from "react"/);
  });

  test('should handle ECMAScript module syntax variations', () => {
    const sourceCode = `
      import defaultExport from "module-name";
      import * as name from "module-name";
      import { export1 } from "module-name";
      import { export1 as alias1 } from "module-name";
      import { export1, export2 } from "module-name";
      import { export1, export2 as alias2 } from "module-name";
      import defaultExport, { export1 } from "module-name";
      import defaultExport, * as name from "module-name";
      import "module-name";
    `;
    
    const result = parser.parse(sourceCode);
    
    expect(result.groups[0].imports).toHaveLength(9);
    
    const types = result.groups[0].imports.map(imp => imp.type);
    expect(types).toEqual([
      'default',    // defaultExport from "module-name"
      'default',    // * as name from "module-name"
      'named',      // { export1 } from "module-name"
      'named',      // { export1 as alias1 } from "module-name"
      'named',      // { export1, export2 } from "module-name"
      'named',      // { export1, export2 as alias2 } from "module-name"
      'mixed',      // defaultExport, { export1 } from "module-name"
      'mixed',      // defaultExport, * as name from "module-name"
      'sideEffect'  // "module-name"
    ]);
  });

  test('should handle AST parsing with different ECMAScript versions', () => {
    // Test modern import syntax
    const modernSyntax = `
      import { feature } from "es2020-module";
      import dynamicModule from "es2021-feature";
    `;
    
    const result = parser.parse(modernSyntax);
    
    expect(result.groups[0].imports).toHaveLength(2);
    expect(result.groups[0].imports[0].source).toBe('es2020-module');
    expect(result.groups[0].imports[1].source).toBe('es2021-feature');
  });

  test('should correctly handle empty import declarations', () => {
    const sourceCode = `
      import {} from "empty-imports";
      import {  } from "whitespace-empty";
    `;
    
    const result = parser.parse(sourceCode);
    
    expect(result.groups[0].imports).toHaveLength(2);
    
    result.groups[0].imports.forEach(imp => {
      expect(imp.type).toBe('named');
      expect(imp.specifiers).toHaveLength(0);
      expect(imp.defaultImport).toBeUndefined();
    });
  });

  test('should preserve AST structure integrity during parsing', () => {
    const sourceCode = `
      import React from "react";
      const component = () => {
        return React.createElement('div');
      };
    `;
    
    const result = parser.parse(sourceCode);
    
    // Should only extract import declarations, not other AST nodes
    expect(result.groups[0].imports).toHaveLength(1);
    expect(result.groups[0].imports[0].source).toBe('react');
    expect(result.groups[0].imports[0].type).toBe('default');
  });

  test('should handle malformed AST gracefully', () => {
    const malformedCode = `
      import React from "react"
      // Missing semicolon should still be parseable by TypeScript parser
      import { useState } from "react";
    `;
    
    const result = parser.parse(malformedCode);
    
    expect(result.groups[0].imports).toHaveLength(2);
    expect(result.groups[0].imports[0].source).toBe('react');
    expect(result.groups[0].imports[1].source).toBe('react');
  });
});