import * as path from 'path';
import { ConfigLoader } from '../../src/utils/configLoader';
import { TidyJSConfigFile } from '../../src/types';

jest.mock('vscode');
jest.mock('../../src/utils/log');

describe('ConfigLoader - alias resolution in convertFileConfigToConfig', () => {
    describe('relative path resolution', () => {
        it('should resolve relative alias paths against configPath directory', () => {
            const configPath = '/Users/test/project/.tidyjsrc';
            const fileConfig: TidyJSConfigFile = {
                pathResolution: {
                    mode: 'absolute',
                    aliases: {
                        '@app/*': ['./src/app/*'],
                        '@utils/*': ['./src/utils/*'],
                    },
                },
            };

            const result = ConfigLoader.convertFileConfigToConfig(fileConfig, configPath);

            expect(result.pathResolution!.aliases!['@app/*']).toEqual([
                path.resolve('/Users/test/project', './src/app/*'),
            ]);
            expect(result.pathResolution!.aliases!['@utils/*']).toEqual([
                path.resolve('/Users/test/project', './src/utils/*'),
            ]);
        });

        it('should resolve paths with .. traversal correctly', () => {
            const configPath = '/Users/test/project/packages/app/.tidyjsrc';
            const fileConfig: TidyJSConfigFile = {
                pathResolution: {
                    aliases: {
                        '@shared/*': ['../../shared/src/*'],
                    },
                },
            };

            const result = ConfigLoader.convertFileConfigToConfig(fileConfig, configPath);

            expect(result.pathResolution!.aliases!['@shared/*']).toEqual([
                path.resolve('/Users/test/project/packages/app', '../../shared/src/*'),
            ]);
        });

        it('should handle multiple paths per alias pattern', () => {
            const configPath = '/Users/test/project/.tidyjsrc';
            const fileConfig: TidyJSConfigFile = {
                pathResolution: {
                    aliases: {
                        '@components/*': ['./src/components/*', './src/shared/components/*'],
                    },
                },
            };

            const result = ConfigLoader.convertFileConfigToConfig(fileConfig, configPath);

            expect(result.pathResolution!.aliases!['@components/*']).toHaveLength(2);
            expect(result.pathResolution!.aliases!['@components/*'][0]).toBe(
                path.resolve('/Users/test/project', './src/components/*')
            );
            expect(result.pathResolution!.aliases!['@components/*'][1]).toBe(
                path.resolve('/Users/test/project', './src/shared/components/*')
            );
        });
    });

    describe('absolute paths in aliases', () => {
        it('should keep absolute paths unchanged (path.resolve ignores base for absolute)', () => {
            const configPath = '/Users/test/project/.tidyjsrc';
            const fileConfig: TidyJSConfigFile = {
                pathResolution: {
                    aliases: {
                        '@lib/*': ['/usr/local/shared/lib/*'],
                    },
                },
            };

            const result = ConfigLoader.convertFileConfigToConfig(fileConfig, configPath);

            // path.resolve with an absolute second arg returns it as-is
            expect(result.pathResolution!.aliases!['@lib/*']).toEqual(['/usr/local/shared/lib/*']);
        });
    });

    describe('edge case: configPath is undefined', () => {
        it('should not crash and not resolve aliases when configPath is undefined', () => {
            const fileConfig: TidyJSConfigFile = {
                pathResolution: {
                    mode: 'absolute',
                    aliases: {
                        '@app/*': ['./src/app/*'],
                    },
                },
            };

            // Call without configPath (backward compat with existing tests)
            const result = ConfigLoader.convertFileConfigToConfig(fileConfig);

            // aliases should be passed through as-is (not resolved)
            expect(result.pathResolution).toBeDefined();
            // The aliases should still be present from the spread
            expect(result.pathResolution!.aliases).toEqual({
                '@app/*': ['./src/app/*'],
            });
        });
    });

    describe('edge case: empty aliases', () => {
        it('should handle empty aliases object without crashing', () => {
            const configPath = '/Users/test/project/.tidyjsrc';
            const fileConfig: TidyJSConfigFile = {
                pathResolution: {
                    mode: 'absolute',
                    aliases: {},
                },
            };

            const result = ConfigLoader.convertFileConfigToConfig(fileConfig, configPath);

            expect(result.pathResolution).toBeDefined();
            // Empty object: Object.entries({}) returns [], Object.fromEntries([]) returns {}
            expect(result.pathResolution!.aliases).toEqual({});
        });

        it('should handle alias with empty array value', () => {
            const configPath = '/Users/test/project/.tidyjsrc';
            const fileConfig: TidyJSConfigFile = {
                pathResolution: {
                    aliases: {
                        '@empty/*': [],
                    },
                },
            };

            const result = ConfigLoader.convertFileConfigToConfig(fileConfig, configPath);

            expect(result.pathResolution!.aliases!['@empty/*']).toEqual([]);
        });
    });

    describe('pathResolution without aliases', () => {
        it('should pass through pathResolution fields without aliases', () => {
            const configPath = '/Users/test/project/.tidyjsrc';
            const fileConfig: TidyJSConfigFile = {
                pathResolution: {
                    mode: 'relative',
                    preferredAliases: ['@app'],
                },
            };

            const result = ConfigLoader.convertFileConfigToConfig(fileConfig, configPath);

            expect(result.pathResolution).toEqual({
                mode: 'relative',
                preferredAliases: ['@app'],
            });
        });
    });

    describe('pathResolution is undefined', () => {
        it('should not set pathResolution when fileConfig has none', () => {
            const configPath = '/Users/test/project/.tidyjsrc';
            const fileConfig: TidyJSConfigFile = {
                format: { indent: 2 },
            };

            const result = ConfigLoader.convertFileConfigToConfig(fileConfig, configPath);

            expect(result.pathResolution).toBeUndefined();
        });
    });

    describe('mergeConfigs with aliases', () => {
        it('should override base aliases when override has pathResolution.aliases', () => {
            const base: TidyJSConfigFile = {
                pathResolution: {
                    mode: 'absolute',
                    aliases: {
                        '@old/*': ['./old/*'],
                    },
                },
            };

            const override: TidyJSConfigFile = {
                pathResolution: {
                    aliases: {
                        '@new/*': ['./new/*'],
                    },
                },
            };

            const result = ConfigLoader.mergeConfigs(base, override);

            // Spread merge: override.pathResolution overwrites base.pathResolution keys
            expect(result.pathResolution!.mode).toBe('absolute'); // kept from base
            expect(result.pathResolution!.aliases).toEqual({
                '@new/*': ['./new/*'], // override wins
            });
        });

        it('should keep base aliases when override has no aliases', () => {
            const base: TidyJSConfigFile = {
                pathResolution: {
                    aliases: {
                        '@base/*': ['./base/*'],
                    },
                },
            };

            const override: TidyJSConfigFile = {
                pathResolution: {
                    mode: 'relative',
                },
            };

            const result = ConfigLoader.mergeConfigs(base, override);

            expect(result.pathResolution!.aliases).toEqual({
                '@base/*': ['./base/*'], // kept from base
            });
            expect(result.pathResolution!.mode).toBe('relative'); // from override
        });
    });
});
