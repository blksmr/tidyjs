import { ImportParser, parseImports } from '../../src/parser';
import { Config } from '../../src/types';

describe('ImportParser - Integration Tests', () => {
  const realWorldConfig: Config = {
    groups: [
      {
        name: 'React',
        order: 1,
        isDefault: false,
        match: /^react$/
      },
      {
        name: 'React Related',
        order: 2,
        isDefault: false,
        match: /^react-/
      },
      {
        name: 'Node Modules',
        order: 3,
        isDefault: false,
        match: /^[^.@]/
      },
      {
        name: 'Scoped Packages',
        order: 4,
        isDefault: false,
        match: /^@/
      },
      {
        name: 'Parent Directories',
        order: 5,
        isDefault: false,
        match: /^\.\./
      },
      {
        name: 'Current Directory',
        order: 6,
        isDefault: false,
        match: /^\.\/[^/]/
      },
      {
        name: 'App Components',
        order: 7,
        isDefault: true,
        match: /^(components|pages|hooks|utils|services)/
      },
      {
        name: 'Miscellaneous',
        order: 8,
        isDefault: true
      }
    ],
    importOrder: {
      sideEffect: 0,
      default: 1,
      named: 2,
      typeOnly: 3
    },
    format: {
      onSave: true,
      singleQuote: true,
      indent: 2
    }
  };

  test('should handle a complete real-world React component file', () => {
    const realWorldCode = `
      import "normalize.css";
      import "./global.css";
      
      import React, { useState, useEffect, useCallback } from "react";
      import ReactDOM from "react-dom";
      import { BrowserRouter, Route, Routes } from "react-router-dom";
      
      import lodash from "lodash";
      import axios from "axios";
      import moment from "moment";
      
      import { ThemeProvider } from "@emotion/react";
      import { Button } from "@mui/material";
      import { styled } from "@styled-components/native";
      
      import { config } from "../../config";
      import { utils } from "../utils";
      import { constants } from "../constants";
      
      import { Header } from "./Header";
      import { Footer } from "./Footer";
      
      import { useAuth } from "hooks/useAuth";
      import { UserService } from "services/UserService";
      import { HomePage } from "pages/HomePage";
      
      import customModule from "custom:module";
    `;

    const parser = new ImportParser(realWorldConfig);
    const result = parser.parse(realWorldCode);

    expect(result.groups).toHaveLength(8);

    // Verify React group
    const reactGroup = result.groups[0];
    expect(reactGroup.name).toBe('React');
    expect(reactGroup.imports).toHaveLength(1);
    expect(reactGroup.imports[0].source).toBe('react');

    // Verify React Related group
    const reactRelatedGroup = result.groups[1];
    expect(reactRelatedGroup.name).toBe('React Related');
    expect(reactRelatedGroup.imports).toHaveLength(2);
    expect(reactRelatedGroup.imports.map(i => i.source)).toEqual(['react-dom', 'react-router-dom']);

    // Verify Node Modules group
    const nodeModulesGroup = result.groups[2];
    expect(nodeModulesGroup.name).toBe('Node Modules');
    expect(nodeModulesGroup.imports).toHaveLength(3);
    expect(nodeModulesGroup.imports.map(i => i.source)).toEqual(['axios', 'lodash', 'moment']);

    // Verify Scoped Packages group
    const scopedGroup = result.groups[3];
    expect(scopedGroup.name).toBe('Scoped Packages');
    expect(scopedGroup.imports).toHaveLength(3);

    // Verify Parent Directories group
    const parentGroup = result.groups[4];
    expect(parentGroup.name).toBe('Parent Directories');
    expect(parentGroup.imports).toHaveLength(3);

    // Verify Current Directory group
    const currentGroup = result.groups[5];
    expect(currentGroup.name).toBe('Current Directory');
    expect(currentGroup.imports).toHaveLength(2);

    // Verify App Components group
    const appGroup = result.groups[6];
    expect(appGroup.name).toBe('App Components');
    expect(appGroup.imports).toHaveLength(3);

    // Verify Miscellaneous group
    const miscGroup = result.groups[7];
    expect(miscGroup.name).toBe('Miscellaneous');
    expect(miscGroup.imports).toHaveLength(1);
    expect(miscGroup.imports[0].source).toBe('custom:module');
  });

  test('should handle TypeScript-style imports', () => {
    const typescriptCode = `
      import type { ComponentType } from "react";
      import type { User } from "./types";
      import React from "react";
      import { useState } from "react";
    `;

    const parser = new ImportParser(realWorldConfig);
    const result = parser.parse(typescriptCode);

    // Note: The current parser doesn't distinguish TypeScript type imports
    // but we test that it handles them as regular imports
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].imports).toHaveLength(4);
  });

  test('should handle complex project structure imports', () => {
    const complexCode = `
      import { api } from "services/api/userService";
      import { Button } from "components/ui/Button";
      import { Modal } from "components/common/Modal";
      import { useLocalStorage } from "hooks/storage/useLocalStorage";
      import { formatDate } from "utils/dateUtils";
      import { ROUTES } from "constants/routes";
      import { HomePage } from "pages/home/HomePage";
    `;

    const parser = new ImportParser(realWorldConfig);
    const result = parser.parse(complexCode);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].name).toBe('App Components');
    expect(result.groups[0].imports).toHaveLength(7);
  });

  test('should maintain import order within groups for mixed types', () => {
    const mixedCode = `
      import "react/index.css";
      import React, { Component } from "react";
      import { Fragment } from "react";
      import ReactDOM from "react-dom";
    `;

    const parser = new ImportParser(realWorldConfig);
    const result = parser.parse(mixedCode);

    const reactGroup = result.groups.find(g => g.name === 'React');
    const reactRelatedGroup = result.groups.find(g => g.name === 'React Related');

    expect(reactGroup!.imports).toHaveLength(3);
    expect(reactRelatedGroup!.imports).toHaveLength(1);

    // Within React group, should be sorted by type then alphabetically
    const reactImports = reactGroup!.imports;
    expect(reactImports[0].type).toBe('sideEffect'); // CSS import
    expect(reactImports[1].type).toBe('mixed');      // React, { Component }
    expect(reactImports[2].type).toBe('named');      // { Fragment }
  });

  test('should handle empty groups gracefully in real-world scenario', () => {
    const simpleCode = `
      import React from "react";
      import { utils } from "./utils";
    `;

    const parser = new ImportParser(realWorldConfig);
    const result = parser.parse(simpleCode);

    // Should only create groups that have imports
    expect(result.groups.length).toBeLessThan(realWorldConfig.groups.length);
    expect(result.groups.every(group => group.imports.length > 0)).toBe(true);
  });

  test('should handle performance with large number of imports', () => {
    const manyImports = Array.from({ length: 100 }, (_, i) => 
      `import module${i} from "module${i}";`
    ).join('\n');

    const parser = new ImportParser(realWorldConfig);
    const startTime = performance.now();
    const result = parser.parse(manyImports);
    const endTime = performance.now();

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].imports).toHaveLength(100);
    expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
  });

  test('should produce consistent results with parseImports function', () => {
    const code = `
      import React from "react";
      import { utils } from "./utils";
      import lodash from "lodash";
    `;

    const parser = new ImportParser(realWorldConfig);
    const classResult = parser.parse(code);
    const functionResult = parseImports(code, realWorldConfig);

    expect(functionResult.groups.length).toBe(classResult.groups.length);
    expect(functionResult.originalImports).toEqual(classResult.originalImports);
    
    for (let i = 0; i < functionResult.groups.length; i++) {
      expect(functionResult.groups[i].name).toBe(classResult.groups[i].name);
      expect(functionResult.groups[i].order).toBe(classResult.groups[i].order);
      expect(functionResult.groups[i].imports.length).toBe(classResult.groups[i].imports.length);
    }
  });

  test('should handle multiple parser instances with different configs', () => {
    const simpleConfig: Config = {
      groups: [{ name: 'All', order: 1, isDefault: true }],
      importOrder: { default: 1, named: 2, typeOnly: 3, sideEffect: 0 },
      format: { onSave: true }
    };

    const parser1 = new ImportParser(realWorldConfig);
    const parser2 = new ImportParser(simpleConfig);

    const code = `
      import React from "react";
      import { utils } from "./utils";
    `;

    const result1 = parser1.parse(code);
    const result2 = parser2.parse(code);

    expect(result1.groups.length).toBeGreaterThan(result2.groups.length);
    expect(result2.groups).toHaveLength(1);
    expect(result2.groups[0].name).toBe('All');
  });

  test('should handle real-world error scenarios gracefully', () => {
    const problematicCode = `
      import React from "react";
      import { broken from "broken-module";
      import { working } from "./working";
    `;

    const parser = new ImportParser(realWorldConfig);
    const result = parser.parse(problematicCode);

    expect(result.invalidImports).toBeDefined();
    expect(result.groups).toHaveLength(0);
  });
});