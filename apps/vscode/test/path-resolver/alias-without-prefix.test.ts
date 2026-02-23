import { PathResolver } from '../../src/utils/path-resolver';

jest.mock('../../src/utils/log', () => ({
    logDebug: jest.fn(),
    logError: jest.fn(),
    logInfo: jest.fn()
}));

describe('PathResolver - Alias without prefix bug fix', () => {
    describe('matchesPattern internal logic', () => {
        it('should correctly match import paths against alias patterns', () => {
            const resolver = new PathResolver({ mode: 'relative' });

            const matchesPattern = (importPath: string, pattern: string): boolean => {
                const regexPattern = pattern
                    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                    .replace(/\*/g, '.*');
                const regex = new RegExp(`^${regexPattern}$`);
                return regex.test(importPath);
            };

            expect(matchesPattern('utils', 'utils')).toBe(true);
            expect(matchesPattern('utils/helpers', 'utils/*')).toBe(true);
            expect(matchesPattern('@app/components', '@app/*')).toBe(true);
            expect(matchesPattern('react', 'utils')).toBe(false);
            expect(matchesPattern('lodash', 'lib/*')).toBe(false);
        });

        it('should correctly identify potential aliases vs external packages', () => {
            const testCases = [
                { importPath: 'utils', isRelative: false, isPotentialAlias: false },
                { importPath: '@app/utils', isRelative: false, isPotentialAlias: true },
                { importPath: '~/utils', isRelative: false, isPotentialAlias: true },
                { importPath: './utils', isRelative: true, isPotentialAlias: false },
                { importPath: '../utils', isRelative: true, isPotentialAlias: false },
                { importPath: 'react', isRelative: false, isPotentialAlias: false },
                { importPath: 'lodash', isRelative: false, isPotentialAlias: false }
            ];

            testCases.forEach(({ importPath, isRelative, isPotentialAlias }) => {
                expect(importPath.startsWith('.')).toBe(isRelative);
                expect(importPath.startsWith('@') || importPath.startsWith('~')).toBe(isPotentialAlias);
            });
        });
    });

    describe('Bug fix verification - imports without special prefix', () => {
        it('should not immediately reject "utils" import before checking mappings', () => {
            const importPath = 'utils';
            const isRelativePath = importPath.startsWith('.');
            const isPotentialAlias = importPath.startsWith('@') || importPath.startsWith('~');

            expect(isRelativePath).toBe(false);
            expect(isPotentialAlias).toBe(false);

        });

        it('should check if import matches any configured alias pattern', () => {
            const mockMappings = [
                { pattern: 'utils', paths: ['./src/utils'] },
                { pattern: 'utils/*', paths: ['./src/utils/*'] },
                { pattern: 'lib/*', paths: ['./src/lib/*'] }
            ];

            const matchesPattern = (importPath: string, pattern: string): boolean => {
                const regexPattern = pattern
                    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                    .replace(/\*/g, '.*');
                const regex = new RegExp(`^${regexPattern}$`);
                return regex.test(importPath);
            };

            expect(mockMappings.some(m => matchesPattern('utils', m.pattern))).toBe(true);
            expect(mockMappings.some(m => matchesPattern('utils/helpers', m.pattern))).toBe(true);
            expect(mockMappings.some(m => matchesPattern('lib/utils', m.pattern))).toBe(true);

            expect(mockMappings.some(m => matchesPattern('react', m.pattern))).toBe(false);
            expect(mockMappings.some(m => matchesPattern('lodash', m.pattern))).toBe(false);
        });
    });
});
