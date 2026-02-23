import { ConfigLoader } from '../../src/utils/configLoader';
import type { TidyJSConfigFile } from '@tidyjs/core';

jest.mock('vscode');
jest.mock('../../src/utils/log');

describe('Config edge cases', () => {
    describe('mergeConfigs - shallow spread preserves base format properties', () => {
        it('should preserve base trailingComma when override only has indent', () => {
            const base: TidyJSConfigFile = {
                format: {
                    trailingComma: 'always',
                    singleQuote: true,
                    indent: 4,
                },
            };

            const override: TidyJSConfigFile = {
                format: {
                    indent: 2,
                },
            };

            const result = ConfigLoader.mergeConfigs(base, override);

            expect(result.format?.trailingComma).toBe('always');
            expect(result.format?.singleQuote).toBe(true);
            expect(result.format?.indent).toBe(2);
        });

        it('should preserve base sortSpecifiers when override only changes bracketSpacing', () => {
            const base: TidyJSConfigFile = {
                format: {
                    sortSpecifiers: 'alpha',
                    maxLineWidth: 100,
                    blankLinesBetweenGroups: 2,
                },
            };

            const override: TidyJSConfigFile = {
                format: {
                    bracketSpacing: false,
                },
            };

            const result = ConfigLoader.mergeConfigs(base, override);

            expect(result.format?.sortSpecifiers).toBe('alpha');
            expect(result.format?.maxLineWidth).toBe(100);
            expect(result.format?.blankLinesBetweenGroups).toBe(2);
            expect(result.format?.bracketSpacing).toBe(false);
        });

        it('should allow override to explicitly set sortSpecifiers to false', () => {
            const base: TidyJSConfigFile = {
                format: {
                    sortSpecifiers: 'length',
                },
            };

            const override: TidyJSConfigFile = {
                format: {
                    sortSpecifiers: false,
                },
            };

            const result = ConfigLoader.mergeConfigs(base, override);

            expect(result.format?.sortSpecifiers).toBe(false);
        });
    });

    describe('convertFileConfigToConfig - edge cases', () => {
        it('should handle group without order (defaults to 999)', () => {
            const fileConfig: TidyJSConfigFile = {
                groups: [
                    { name: 'NoOrder', match: '^test' },
                ],
            };

            const result = ConfigLoader.convertFileConfigToConfig(fileConfig);

            expect(result.groups![0].order).toBe(999);
        });

        it('should handle group with isDefault (deprecated) migration', () => {
            const fileConfig: TidyJSConfigFile = {
                groups: [
                    { name: 'Other', isDefault: true } as any,
                ],
            };

            const result = ConfigLoader.convertFileConfigToConfig(fileConfig);

            expect(result.groups![0].default).toBe(true);
        });

        it('should prioritize default over isDefault when both present', () => {
            const fileConfig: TidyJSConfigFile = {
                groups: [
                    { name: 'Other', default: false, isDefault: true } as any,
                ],
            };

            const result = ConfigLoader.convertFileConfigToConfig(fileConfig);

            expect(result.groups![0].default).toBe(false);
        });

        it('should create RegExp from match string in file config', () => {
            const fileConfig: TidyJSConfigFile = {
                groups: [
                    { name: 'React', match: '^react', order: 1 },
                ],
            };

            const result = ConfigLoader.convertFileConfigToConfig(fileConfig);

            expect(result.groups![0].match).toBeInstanceOf(RegExp);
            expect(result.groups![0].match!.test('react')).toBe(true);
            expect(result.groups![0].match!.test('vue')).toBe(false);
        });

        it('should handle importOrder with partial values (fills defaults)', () => {
            const fileConfig: TidyJSConfigFile = {
                importOrder: {
                    sideEffect: 5,
                },
            };

            const result = ConfigLoader.convertFileConfigToConfig(fileConfig);

            expect(result.importOrder!.sideEffect).toBe(5);
            expect(result.importOrder!.default).toBe(1);
            expect(result.importOrder!.named).toBe(2);
            expect(result.importOrder!.typeOnly).toBe(3);
        });

        it('should pass format options through directly from file config', () => {
            const fileConfig: TidyJSConfigFile = {
                format: {
                    trailingComma: 'always',
                    sortSpecifiers: 'alpha',
                    maxLineWidth: 120,
                    enforceNewlineAfterImports: false,
                    blankLinesBetweenGroups: 0,
                },
            };

            const result = ConfigLoader.convertFileConfigToConfig(fileConfig);

            expect(result.format?.trailingComma).toBe('always');
            expect(result.format?.sortSpecifiers).toBe('alpha');
            expect(result.format?.maxLineWidth).toBe(120);
            expect(result.format?.enforceNewlineAfterImports).toBe(false);
            expect(result.format?.blankLinesBetweenGroups).toBe(0);
        });

        it('should handle sortSpecifiers set to false in file config', () => {
            const fileConfig: TidyJSConfigFile = {
                format: {
                    sortSpecifiers: false,
                },
            };

            const result = ConfigLoader.convertFileConfigToConfig(fileConfig);

            expect(result.format?.sortSpecifiers).toBe(false);
        });

        it('should handle convertFileConfigToConfig without configPath (legacy call)', () => {
            const fileConfig: TidyJSConfigFile = {
                groups: [{ name: 'Test', match: '^test', order: 0 }],
                format: { indent: 2 },
                pathResolution: {
                    mode: 'absolute',
                    aliases: { '@app/*': ['./src/app/*'] },
                },
            };

            // No crash, aliases not resolved but kept
            const result = ConfigLoader.convertFileConfigToConfig(fileConfig);

            expect(result.groups).toHaveLength(1);
            expect(result.format?.indent).toBe(2);
            expect(result.pathResolution?.mode).toBe('absolute');
            // aliases should be kept from spread, not resolved
            expect(result.pathResolution?.aliases).toEqual({ '@app/*': ['./src/app/*'] });
        });
    });

    describe('mergeConfigs - importOrder merge', () => {
        it('should merge importOrder fields (not replace entirely)', () => {
            const base: TidyJSConfigFile = {
                importOrder: {
                    sideEffect: 0,
                    default: 1,
                    named: 2,
                    typeOnly: 3,
                },
            };

            const override: TidyJSConfigFile = {
                importOrder: {
                    sideEffect: 10,
                },
            };

            const result = ConfigLoader.mergeConfigs(base, override);

            expect(result.importOrder?.sideEffect).toBe(10);
            expect(result.importOrder?.default).toBe(1);
            expect(result.importOrder?.named).toBe(2);
            expect(result.importOrder?.typeOnly).toBe(3);
        });
    });

    describe('mergeConfigs - groups replacement', () => {
        it('should replace groups entirely (not merge arrays)', () => {
            const base: TidyJSConfigFile = {
                groups: [
                    { name: 'Base1', order: 0 },
                    { name: 'Base2', order: 1 },
                ],
            };

            const override: TidyJSConfigFile = {
                groups: [
                    { name: 'Override1', order: 0 },
                ],
            };

            const result = ConfigLoader.mergeConfigs(base, override);

            expect(result.groups).toHaveLength(1);
            expect(result.groups![0].name).toBe('Override1');
        });

        it('should keep base groups when override has no groups', () => {
            const base: TidyJSConfigFile = {
                groups: [
                    { name: 'Base1', order: 0 },
                ],
            };

            const override: TidyJSConfigFile = {
                format: { indent: 2 },
            };

            const result = ConfigLoader.mergeConfigs(base, override);

            expect(result.groups).toHaveLength(1);
            expect(result.groups![0].name).toBe('Base1');
        });
    });

    describe('mergeConfigs - pathResolution shallow spread', () => {
        it('should merge pathResolution fields (not replace entirely)', () => {
            const base: TidyJSConfigFile = {
                pathResolution: {
                    mode: 'absolute',
                    preferredAliases: ['@app'],
                },
            };

            const override: TidyJSConfigFile = {
                pathResolution: {
                    mode: 'relative',
                },
            };

            const result = ConfigLoader.mergeConfigs(base, override);

            expect(result.pathResolution?.mode).toBe('relative');
            expect(result.pathResolution?.preferredAliases).toEqual(['@app']);
        });
    });

    describe('mergeConfigs - excludedFolders replacement', () => {
        it('should replace excludedFolders entirely when override provides them', () => {
            const base: TidyJSConfigFile = {
                excludedFolders: ['node_modules', 'dist'],
            };

            const override: TidyJSConfigFile = {
                excludedFolders: ['build'],
            };

            const result = ConfigLoader.mergeConfigs(base, override);

            expect(result.excludedFolders).toEqual(['build']);
        });

        it('should keep base excludedFolders when override has none', () => {
            const base: TidyJSConfigFile = {
                excludedFolders: ['node_modules'],
            };

            const override: TidyJSConfigFile = {
                format: { indent: 2 },
            };

            const result = ConfigLoader.mergeConfigs(base, override);

            expect(result.excludedFolders).toEqual(['node_modules']);
        });
    });

    describe('schema consistency checks via convertFileConfigToConfig', () => {
        it('should handle all new format options from schema', () => {
            const fileConfig: TidyJSConfigFile = {
                format: {
                    indent: 2,
                    removeUnusedImports: true,
                    removeMissingModules: true,
                    singleQuote: false,
                    bracketSpacing: false,
                    sortEnumMembers: true,
                    sortExports: true,
                    sortClassProperties: true,
                    organizeReExports: true,
                    enforceNewlineAfterImports: false,
                    blankLinesBetweenGroups: 0,
                    trailingComma: 'always',
                    sortSpecifiers: 'alpha',
                    maxLineWidth: 80,
                },
            };

            const result = ConfigLoader.convertFileConfigToConfig(fileConfig);

            // All format options should be passed through
            expect(result.format).toEqual(fileConfig.format);
        });

        it('should handle blankLinesBetweenGroups set to 0', () => {
            const fileConfig: TidyJSConfigFile = {
                format: {
                    blankLinesBetweenGroups: 0,
                },
            };

            const result = ConfigLoader.convertFileConfigToConfig(fileConfig);

            expect(result.format?.blankLinesBetweenGroups).toBe(0);
        });

        it('should handle maxLineWidth set to 0 (disabled)', () => {
            const fileConfig: TidyJSConfigFile = {
                format: {
                    maxLineWidth: 0,
                },
            };

            const result = ConfigLoader.convertFileConfigToConfig(fileConfig);

            expect(result.format?.maxLineWidth).toBe(0);
        });
    });
});
