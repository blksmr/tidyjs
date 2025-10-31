import { tsConfigLoader } from '../../src/utils/config-loaders';
import * as path from 'path';

jest.mock('../../src/utils/log', () => ({
    logDebug: jest.fn(),
    logError: jest.fn(),
    logInfo: jest.fn()
}));

describe('tsConfigLoader - baseUrl support', () => {
    describe('baseUrl without paths', () => {
        it('should create wildcard mapping when only baseUrl is defined', () => {
            const configPath = '/Users/test/project/tsconfig.json';
            const config = {
                compilerOptions: {
                    baseUrl: 'src'
                }
            };

            const mappings = tsConfigLoader.extractAliases(configPath, config);

            expect(mappings).toHaveLength(1);
            expect(mappings[0].pattern).toBe('*');
            expect(mappings[0].paths[0]).toContain('src');
            expect(mappings[0].paths[0]).toMatch(/src\/\*$/);
        });

        it('should handle baseUrl with dot (current directory)', () => {
            const configPath = '/Users/test/project/tsconfig.json';
            const config = {
                compilerOptions: {
                    baseUrl: '.'
                }
            };

            const mappings = tsConfigLoader.extractAliases(configPath, config);

            expect(mappings).toHaveLength(1);
            expect(mappings[0].pattern).toBe('*');
        });

        it('should handle nested baseUrl path', () => {
            const configPath = '/Users/test/project/tsconfig.json';
            const config = {
                compilerOptions: {
                    baseUrl: './src/app'
                }
            };

            const mappings = tsConfigLoader.extractAliases(configPath, config);

            expect(mappings).toHaveLength(1);
            expect(mappings[0].pattern).toBe('*');
            expect(mappings[0].paths[0]).toContain('src');
            expect(mappings[0].paths[0]).toContain('app');
        });
    });

    describe('baseUrl with explicit paths', () => {
        it('should use explicit paths when both baseUrl and paths are defined', () => {
            const configPath = '/Users/test/project/tsconfig.json';
            const config = {
                compilerOptions: {
                    baseUrl: 'src',
                    paths: {
                        '@app/*': ['app/*'],
                        '@utils/*': ['utils/*']
                    }
                }
            };

            const mappings = tsConfigLoader.extractAliases(configPath, config);

            expect(mappings).toHaveLength(2);
            expect(mappings.find(m => m.pattern === '@app/*')).toBeDefined();
            expect(mappings.find(m => m.pattern === '@utils/*')).toBeDefined();
            expect(mappings.find(m => m.pattern === '*')).toBeUndefined();
        });

        it('should resolve paths relative to baseUrl', () => {
            const configPath = '/Users/test/project/tsconfig.json';
            const config = {
                compilerOptions: {
                    baseUrl: 'src',
                    paths: {
                        'utils/*': ['shared/utils/*']
                    }
                }
            };

            const mappings = tsConfigLoader.extractAliases(configPath, config);

            expect(mappings).toHaveLength(1);
            expect(mappings[0].paths[0]).toContain('src');
            expect(mappings[0].paths[0]).toContain('shared');
            expect(mappings[0].paths[0]).toContain('utils');
        });
    });

    describe('no compilerOptions', () => {
        it('should return empty array when no compilerOptions', () => {
            const configPath = '/Users/test/project/tsconfig.json';
            const config = {
                include: ['src/**/*']
            };

            const mappings = tsConfigLoader.extractAliases(configPath, config);

            expect(mappings).toHaveLength(0);
        });

        it('should return empty array when compilerOptions is empty', () => {
            const configPath = '/Users/test/project/tsconfig.json';
            const config = {
                compilerOptions: {}
            };

            const mappings = tsConfigLoader.extractAliases(configPath, config);

            expect(mappings).toHaveLength(0);
        });
    });

    describe('realistic scenarios', () => {
        it('should handle Yeap-UI-Apps ds package config', () => {
            const configPath = '/Users/test/Yeap-UI-Apps/packages/ds/tsconfig.json';
            const config = {
                compilerOptions: {
                    baseUrl: 'src'
                }
            };

            const mappings = tsConfigLoader.extractAliases(configPath, config);

            expect(mappings).toHaveLength(1);
            expect(mappings[0].pattern).toBe('*');
            expect(mappings[0].paths[0]).toMatch(/packages\/ds\/src\/\*$/);
        });

        it('should handle monorepo root config with paths', () => {
            const configPath = '/Users/test/monorepo/tsconfig.json';
            const config = {
                compilerOptions: {
                    baseUrl: '.',
                    paths: {
                        '@shared/*': ['packages/shared/src/*'],
                        '@ui/*': ['packages/ui/src/*']
                    }
                }
            };

            const mappings = tsConfigLoader.extractAliases(configPath, config);

            expect(mappings).toHaveLength(2);
            expect(mappings.find(m => m.pattern === '@shared/*')).toBeDefined();
            expect(mappings.find(m => m.pattern === '@ui/*')).toBeDefined();
        });
    });
});
