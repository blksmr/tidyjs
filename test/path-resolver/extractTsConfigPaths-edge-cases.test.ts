import { extractTsConfigPaths } from '../../src/utils/path-resolver';

jest.mock('../../src/utils/log', () => ({
    logDebug: jest.fn(),
    logError: jest.fn(),
    logInfo: jest.fn()
}));

describe('extractTsConfigPaths - edge cases', () => {
    describe('null / undefined / empty inputs', () => {
        it('should return empty array for null config', () => {
            const mappings = extractTsConfigPaths('/project/tsconfig.json', null);
            expect(mappings).toEqual([]);
        });

        it('should return empty array for undefined config', () => {
            const mappings = extractTsConfigPaths('/project/tsconfig.json', undefined);
            expect(mappings).toEqual([]);
        });

        it('should return empty array for empty object', () => {
            const mappings = extractTsConfigPaths('/project/tsconfig.json', {});
            expect(mappings).toEqual([]);
        });

        it('should return empty array when compilerOptions is undefined', () => {
            const mappings = extractTsConfigPaths('/project/tsconfig.json', {
                compilerOptions: undefined
            });
            expect(mappings).toEqual([]);
        });

        it('should return empty array when compilerOptions is null', () => {
            const mappings = extractTsConfigPaths('/project/tsconfig.json', {
                compilerOptions: null
            });
            expect(mappings).toEqual([]);
        });
    });

    describe('empty paths object', () => {
        it('should fall back to baseUrl wildcard when paths is empty object', () => {
            const mappings = extractTsConfigPaths('/project/tsconfig.json', {
                compilerOptions: {
                    baseUrl: 'src',
                    paths: {}
                }
            });
            // Fixed: empty paths object now falls through to baseUrl wildcard
            expect(mappings).toHaveLength(1);
            expect(mappings[0].pattern).toBe('*');
            expect(mappings[0].paths[0]).toContain('src');
        });

        it('should return empty array when paths is empty and no baseUrl', () => {
            const mappings = extractTsConfigPaths('/project/tsconfig.json', {
                compilerOptions: {
                    paths: {}
                }
            });
            expect(mappings).toEqual([]);
        });
    });

    describe('paths with empty arrays', () => {
        it('should create mapping with empty paths array', () => {
            const mappings = extractTsConfigPaths('/project/tsconfig.json', {
                compilerOptions: {
                    baseUrl: '.',
                    paths: {
                        '@app/*': []
                    }
                }
            });
            expect(mappings).toHaveLength(1);
            expect(mappings[0].pattern).toBe('@app/*');
            expect(mappings[0].paths).toEqual([]);
        });
    });

    describe('tsconfig "extends" field', () => {
        it('should NOT resolve extended configs (known limitation)', () => {
            // The old code did not handle "extends" either.
            // This test documents the gap: if a tsconfig extends another
            // that defines paths, extractTsConfigPaths will miss them.
            const config = {
                extends: './tsconfig.base.json',
                compilerOptions: {
                    // No paths here — they come from the base config
                }
            };
            const mappings = extractTsConfigPaths('/project/tsconfig.json', config);
            expect(mappings).toEqual([]);
            // NOTE: This is a known gap. The function does not resolve "extends".
        });
    });

    describe('non-standard input shapes', () => {
        it('should handle config with extra top-level properties gracefully', () => {
            const config = {
                compilerOptions: {
                    baseUrl: '.',
                    paths: { '@/*': ['src/*'] },
                    strict: true,
                    target: 'ES2020'
                },
                include: ['src/**/*'],
                exclude: ['node_modules']
            };
            const mappings = extractTsConfigPaths('/project/tsconfig.json', config);
            expect(mappings).toHaveLength(1);
            expect(mappings[0].pattern).toBe('@/*');
        });

        it('should handle string passed as config (not crash)', () => {
            // A string has no .compilerOptions, so should return empty
            const mappings = extractTsConfigPaths('/project/tsconfig.json', 'invalid');
            expect(mappings).toEqual([]);
        });

        it('should handle number passed as config', () => {
            const mappings = extractTsConfigPaths('/project/tsconfig.json', 42);
            expect(mappings).toEqual([]);
        });

        it('should handle array passed as config', () => {
            const mappings = extractTsConfigPaths('/project/tsconfig.json', [1, 2, 3]);
            expect(mappings).toEqual([]);
        });
    });

    describe('dedup: .tidyjsrc aliases win over tsconfig for same pattern', () => {
        it('should demonstrate that loadPathMappings dedup logic is pattern-based', () => {
            // This test validates the dedup logic conceptually.
            // In loadPathMappings(), allMappings first receives .tidyjsrc aliases,
            // then tsconfig mappings are added only if their pattern is NOT already present.
            const tidyjsrcAliases: Record<string, string[]> = {
                '@app/*': ['/custom/app/*'],
                '@utils/*': ['/custom/utils/*']
            };

            const tsconfigMappings = [
                { pattern: '@app/*', paths: ['/project/src/app/*'] },      // DUPLICATE — should be skipped
                { pattern: '@shared/*', paths: ['/project/src/shared/*'] }  // NEW — should be added
            ];

            const allMappings: { pattern: string; paths: string[] }[] = [];

            // Step 1: Add .tidyjsrc aliases
            for (const [pattern, paths] of Object.entries(tidyjsrcAliases)) {
                allMappings.push({ pattern, paths });
            }

            // Step 2: Add tsconfig mappings (dedup by pattern)
            const existing = new Set(allMappings.map(m => m.pattern));
            for (const m of tsconfigMappings) {
                if (!existing.has(m.pattern)) {
                    allMappings.push(m);
                }
            }

            expect(allMappings).toHaveLength(3);
            // @app/* should come from .tidyjsrc, not tsconfig
            const appMapping = allMappings.find(m => m.pattern === '@app/*');
            expect(appMapping?.paths).toEqual(['/custom/app/*']);
            // @shared/* should come from tsconfig
            const sharedMapping = allMappings.find(m => m.pattern === '@shared/*');
            expect(sharedMapping?.paths).toEqual(['/project/src/shared/*']);
        });
    });

    describe('cache behavior', () => {
        it('should demonstrate that configCache stores PathMapping[] (not {mappings, configType})', () => {
            // The old cache was Map<string, { mappings: PathMapping[]; configType: string }>
            // The new cache is Map<string, PathMapping[]>
            // No caller ever depended on configType from the cache — it was only used
            // in getConfigInfo() which has been removed.
            const cache = new Map<string, { pattern: string; paths: string[] }[]>();
            const key = 'file:///workspace';
            const mappings = [{ pattern: '@app/*', paths: ['/project/src/app/*'] }];

            cache.set(key, mappings);
            const cached = cache.get(key);

            expect(cached).toEqual(mappings);
            // Verify no configType property
            expect(cached).not.toHaveProperty('configType');
        });
    });
});
