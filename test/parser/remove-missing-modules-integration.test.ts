import { ImportParser } from '../../src/parser';
import { Config } from '../../src/types';

describe('Remove Missing Modules Integration', () => {
    it('should handle removeUnusedImports=true with removeMissingModules=false correctly', () => {
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
                removeUnusedImports: true, // This is ON
                removeMissingModules: false, // This is OFF
                singleQuote: true,
                bracketSpacing: true,
            },
            excludedFolders: [],
        };

        const sourceCode = `
import { usedFunction } from './existing-module';
import { unusedFunction } from './existing-module';
import { functionFromMissing } from './non-existent-module';

console.log(usedFunction);
// unusedFunction is not used
// functionFromMissing is not used AND from missing module
`;

        const parser = new ImportParser(config);
        
        // Simulate the scenario from extension.ts
        const unusedImportsList = ['unusedFunction', 'functionFromMissing'];
        const missingModules = undefined; // Should be undefined when removeMissingModules is false
        
        const result = parser.parse(sourceCode, missingModules, unusedImportsList);
        
        // Should have 2 groups/imports
        expect(result.groups.length).toBe(1);
        expect(result.groups[0].imports.length).toBe(2);
        
        // Should keep the used function from existing module
        const existingImport = result.groups[0].imports.find(imp => imp.source === './existing-module');
        expect(existingImport).toBeDefined();
        expect(existingImport?.specifiers).toHaveLength(1);
        expect(existingImport?.specifiers[0]).toBe('usedFunction');
        
        // Should keep the import from missing module (even though unused) because removeMissingModules is false
        const missingImport = result.groups[0].imports.find(imp => imp.source === './non-existent-module');
        expect(missingImport).toBeDefined();
        expect(missingImport?.specifiers).toHaveLength(0); // But specifier removed because it's unused
    });

    it('should not pass missingModules to parser when removeMissingModules is false', () => {
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
import { functionFromMissing } from './non-existent-module';
import { normalFunction } from './existing-module';

console.log(normalFunction);
`;

        const parser = new ImportParser(config);
        
        // When removeMissingModules is false, we should NOT pass missingModules to parse
        const result = parser.parse(sourceCode); // No filtering parameters
        
        // Both imports should be present
        expect(result.groups.length).toBe(1);
        expect(result.groups[0].imports.length).toBe(2);
        
        const importSources = result.groups[0].imports.map(imp => imp.source);
        expect(importSources).toContain('./non-existent-module');
        expect(importSources).toContain('./existing-module');
    });
});