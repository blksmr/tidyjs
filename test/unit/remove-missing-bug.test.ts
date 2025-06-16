// Test pour reproduire le bug exact décrit par l'utilisateur

import { ImportParser } from '../../src/parser';
import { Config } from '../../src/types';

describe('Extension Remove Missing Modules Bug', () => {
    it('should NOT remove any imports when both removeUnusedImports and removeMissingModules are false', () => {
        const config: Config = {
            debug: true,
            groups: [
                {
                    name: 'Misc',
                    order: 0,
                    isDefault: true,
                }
            ],
            importOrder: {
                default: 0,
                named: 1,
                typeOnly: 2,
                sideEffect: 3,
            },
            format: {
                indent: 4,
                removeUnusedImports: false, // Explicitly false
                removeMissingModules: false, // Explicitly false
                singleQuote: true,
                bracketSpacing: true,
            },
            excludedFolders: [],
        };

        const sourceCode = `
import { Component } from '@angular/core';
import { NonExistentService } from './services/non-existent.service';
import { UnusedHelper } from './helpers/unused';

@Component({
    selector: 'app-test',
    template: '<div>Test</div>'
})
export class TestComponent {
    constructor() {
        console.log('Component initialized');
    }
}
`;

        const parser = new ImportParser(config);
        
        // Simulating what extension.ts would do:
        // When both options are false, no filtering parameters should be passed
        const result = parser.parse(sourceCode);
        
        // All 3 imports should be present
        expect(result.groups.length).toBe(1);
        expect(result.groups[0].imports.length).toBe(3);
        
        const importSources = result.groups[0].imports.map(imp => imp.source);
        expect(importSources).toContain('@angular/core');
        expect(importSources).toContain('./services/non-existent.service');
        expect(importSources).toContain('./helpers/unused');
    });

    it('should NOT remove any imports when removeMissingModules is undefined', () => {
        const config: Config = {
            debug: true,
            groups: [
                {
                    name: 'Misc',
                    order: 0,
                    isDefault: true,
                }
            ],
            importOrder: {
                default: 0,
                named: 1,
                typeOnly: 2,
                sideEffect: 3,
            },
            format: {
                indent: 4,
                removeUnusedImports: false,
                // removeMissingModules is undefined - should default to false
                singleQuote: true,
                bracketSpacing: true,
            },
            excludedFolders: [],
        };

        const sourceCode = `
import React from 'react';
import { NonExistentHook } from './hooks/non-existent';
import { Button } from './components/Button';

export function App() {
    return <Button>Click me</Button>;
}
`;

        const parser = new ImportParser(config);
        
        // When removeMissingModules is undefined, it should behave as false
        const result = parser.parse(sourceCode);
        
        // All 3 imports should be present
        expect(result.groups.length).toBe(1);
        expect(result.groups[0].imports.length).toBe(3);
        
        const importSources = result.groups[0].imports.map(imp => imp.source);
        expect(importSources).toContain('react');
        expect(importSources).toContain('./hooks/non-existent');
        expect(importSources).toContain('./components/Button');
    });

    it('should log filtering parameters correctly', () => {
        const config: Config = {
            debug: true,
            groups: [
                {
                    name: 'Misc',
                    order: 0,
                    isDefault: true,
                }
            ],
            importOrder: {
                default: 0,
                named: 1,
                typeOnly: 2,
                sideEffect: 3,
            },
            format: {
                indent: 4,
                removeUnusedImports: false,
                removeMissingModules: false,
                singleQuote: true,
                bracketSpacing: true,
            },
            excludedFolders: [],
        };

        const sourceCode = `
import { helper } from './missing-module';
`;

        const parser = new ImportParser(config);
        
        // Test what parameters would be passed to parse()
        let missingModules: Set<string> | undefined;
        let unusedImportsList: string[] | undefined;
        
        // Simulate extension.ts logic
        if (config.format?.removeUnusedImports === true || config.format?.removeMissingModules === true) {
            // Should NOT enter this block
            missingModules = new Set(['./missing-module']);
            unusedImportsList = ['helper'];
        }
        
        // These should still be undefined
        expect(missingModules).toBeUndefined();
        expect(unusedImportsList).toBeUndefined();
        
        // Parse should be called without filtering parameters
        const result = parser.parse(sourceCode, missingModules, unusedImportsList);
        
        // Import should be kept
        expect(result.groups[0].imports.length).toBe(1);
        expect(result.groups[0].imports[0].source).toBe('./missing-module');
    });
});