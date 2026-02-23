import { describe, expect, test, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

// Mock fs — ConfigLoader reads .tidyjsrc files via fs.promises
jest.mock('fs', () => ({
    promises: {
        access: jest.fn(),
        readFile: jest.fn(),
    },
    constants: { R_OK: 4 }
}));
jest.mock('../../src/utils/log');

// Mock vscode with overridable workspace methods
jest.mock('vscode', () => {
    const originalModule = jest.requireActual('../../test/mocks/vscode') as any;
    return {
        ...originalModule,
        workspace: {
            ...originalModule.workspace,
            getConfiguration: jest.fn(),
            getWorkspaceFolder: jest.fn(),
        }
    };
});

// Import AFTER mocks are installed
import { configManager } from '../../src/utils/config';

const mockAccess = fs.promises.access as jest.MockedFunction<typeof fs.promises.access>;
const mockReadFile = fs.promises.readFile as jest.MockedFunction<typeof fs.promises.readFile>;
const mockGetConfig = vscode.workspace.getConfiguration as jest.Mock;
const mockGetWSFolder = vscode.workspace.getWorkspaceFolder as jest.Mock;

/**
 * Build a getConfiguration mock that returns the given aliases
 * and sensible defaults for everything else.
 */
function fakeVSConfig(aliases: Record<string, string[]>) {
    return (_section?: unknown) => ({
        get: (key: string) => {
            if (key === 'pathResolution.aliases') { return aliases; }
            if (key === 'pathResolution.mode') { return 'absolute'; }
            if (key === 'debug') { return false; }
            return undefined;
        },
        has: () => false,
    });
}

describe('resolveAliasesForUri — multi-root workspace', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Clear internal caches so every test starts fresh
        configManager.clearDocumentCache();
        (configManager as any).configCache.clear();

        // No .tidyjsrc files on disk — forces VS Code settings path
        mockAccess.mockRejectedValue(new Error('ENOENT'));
        mockReadFile.mockRejectedValue(new Error('ENOENT'));
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // ── Helpers ──────────────────────────────────────────────────────────
    function workspaceFolder(rootPath: string, name: string, index: number) {
        return { uri: { fsPath: rootPath, path: rootPath, scheme: 'file' }, name, index };
    }

    // ── Tests ────────────────────────────────────────────────────────────
    test('resolves relative aliases against the correct workspace root for each folder', async () => {
        const aliases = { '@app/*': ['./src/app/*'], '@lib/*': ['./lib/*'] };
        mockGetConfig.mockImplementation(fakeVSConfig(aliases));

        const folderA = workspaceFolder('/repos/frontend', 'frontend', 0);
        const folderB = workspaceFolder('/repos/backend', 'backend', 1);

        // Simulate multi-root: getWorkspaceFolder returns the right folder per URI
        mockGetWSFolder.mockImplementation((uri: any) => {
            const fsPath: string = uri?.fsPath ?? uri?.path ?? '';
            if (fsPath.startsWith('/repos/frontend')) { return folderA; }
            if (fsPath.startsWith('/repos/backend')) { return folderB; }
            return undefined;
        });

        const uriA = vscode.Uri.file('/repos/frontend/src/index.ts');
        const uriB = vscode.Uri.file('/repos/backend/src/server.ts');

        const configA = await configManager.getConfigForUri(uriA);
        // Clear document cache so the second URI isn't served from cache
        configManager.clearDocumentCache();
        (configManager as any).configCache.clear();
        const configB = await configManager.getConfigForUri(uriB);

        // Aliases resolved against frontend root
        expect(configA.pathResolution?.aliases?.['@app/*']).toEqual([
            path.resolve('/repos/frontend', './src/app/*'),
        ]);
        expect(configA.pathResolution?.aliases?.['@lib/*']).toEqual([
            path.resolve('/repos/frontend', './lib/*'),
        ]);

        // Aliases resolved against backend root
        expect(configB.pathResolution?.aliases?.['@app/*']).toEqual([
            path.resolve('/repos/backend', './src/app/*'),
        ]);
        expect(configB.pathResolution?.aliases?.['@lib/*']).toEqual([
            path.resolve('/repos/backend', './lib/*'),
        ]);
    });

    test('absolute alias paths are preserved unchanged', async () => {
        const aliases = { '@shared/*': ['/opt/shared/lib/*'] };
        mockGetConfig.mockImplementation(fakeVSConfig(aliases));

        mockGetWSFolder.mockReturnValue(
            workspaceFolder('/repos/frontend', 'frontend', 0)
        );

        const uri = vscode.Uri.file('/repos/frontend/src/index.ts');
        const config = await configManager.getConfigForUri(uri);

        expect(config.pathResolution?.aliases?.['@shared/*']).toEqual(['/opt/shared/lib/*']);
    });

    test('aliases left raw when no workspace folder matches the URI', async () => {
        const aliases = { '@app/*': ['./src/app/*'] };
        mockGetConfig.mockImplementation(fakeVSConfig(aliases));

        // No workspace folder for this URI
        mockGetWSFolder.mockReturnValue(undefined);

        const uri = vscode.Uri.file('/tmp/scratch/file.ts');
        const config = await configManager.getConfigForUri(uri);

        // Relative path stays unresolved
        expect(config.pathResolution?.aliases?.['@app/*']).toEqual(['./src/app/*']);
    });

    test('mixed absolute and relative paths in the same alias are handled correctly', async () => {
        const aliases = { '@components/*': ['./src/components/*', '/shared/components/*'] };
        mockGetConfig.mockImplementation(fakeVSConfig(aliases));

        mockGetWSFolder.mockReturnValue(
            workspaceFolder('/repos/frontend', 'frontend', 0)
        );

        const uri = vscode.Uri.file('/repos/frontend/src/App.tsx');
        const config = await configManager.getConfigForUri(uri);

        expect(config.pathResolution?.aliases?.['@components/*']).toEqual([
            path.resolve('/repos/frontend', './src/components/*'),
            '/shared/components/*',
        ]);
    });
});
