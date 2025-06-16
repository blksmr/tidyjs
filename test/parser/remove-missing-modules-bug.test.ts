import { ImportParser } from '../../src/parser';
import { Config } from '../../src/types';

describe('Remove Missing Modules Bug', () => {
    it('should NOT remove imports when removeMissingModules is false', () => {
        const config: Config = {
            debug: false,
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
                removeMissingModules: false, // Explicitly false
                singleQuote: true,
                bracketSpacing: true,
            },
            excludedFolders: [],
        };

        const sourceCode = `
import { nonExistentFunction } from './non-existent-module';
import { existingFunction } from './existing-module';

console.log(existingFunction);
`;

        const parser = new ImportParser(config);
        
        // Simulate missing modules
        const missingModules = new Set(['./non-existent-module']);
        
        // Parse without passing missingModules since removeMissingModules is false
        const result = parser.parse(sourceCode);
        
        // Both imports should be present
        expect(result.groups.length).toBe(1);
        expect(result.groups[0].imports.length).toBe(2);
        
        const importSources = result.groups[0].imports.map(imp => imp.source);
        expect(importSources).toContain('./non-existent-module');
        expect(importSources).toContain('./existing-module');
    });

    it('should NOT remove imports when removeMissingModules is undefined', () => {
        const config: Config = {
            debug: false,
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
                // removeMissingModules is undefined/missing
                singleQuote: true,
                bracketSpacing: true,
            },
            excludedFolders: [],
        };

        const sourceCode = `
import { nonExistentFunction } from './non-existent-module';
import { existingFunction } from './existing-module';

console.log(existingFunction);
`;

        const parser = new ImportParser(config);
        
        // Parse without any filtering
        const result = parser.parse(sourceCode);
        
        // Both imports should be present
        expect(result.groups.length).toBe(1);
        expect(result.groups[0].imports.length).toBe(2);
        
        const importSources = result.groups[0].imports.map(imp => imp.source);
        expect(importSources).toContain('./non-existent-module');
        expect(importSources).toContain('./existing-module');
    });
});