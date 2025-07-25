import { describe, expect, test, beforeEach, afterEach, jest } from '@jest/globals';
import { ConfigLoader } from '../../src/utils/configLoader';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

jest.mock('fs', () => ({
    promises: {
        access: jest.fn(),
        readFile: jest.fn(),
    },
    constants: {
        R_OK: 4
    }
}));
jest.mock('../../src/utils/log');
jest.mock('vscode', () => {
    const originalModule = jest.requireActual('../../test/mocks/vscode') as any;
    return {
        ...originalModule,
        workspace: {
            ...originalModule.workspace,
            getWorkspaceFolder: jest.fn()
        }
    };
});

describe('ConfigLoader - excludedFolders interaction', () => {
    const mockAccess = fs.promises.access as jest.MockedFunction<typeof fs.promises.access>;
    const mockReadFile = fs.promises.readFile as jest.MockedFunction<typeof fs.promises.readFile>;

    // Track which files exist and their content
    let mockFileSystem: Map<string, string>;

    beforeEach(() => {
        jest.clearAllMocks();
        ConfigLoader['configCache'].clear();
        
        // Initialize empty file system
        mockFileSystem = new Map();
        
        // Mock fs.promises.access to check if file exists in our mock file system
        mockAccess.mockImplementation((filePath: fs.PathLike) => {
            const pathStr = String(filePath);
            if (mockFileSystem.has(pathStr)) {
                return Promise.resolve();
            }
            return Promise.reject(new Error('ENOENT: no such file or directory'));
        });

        // Mock fs.promises.readFile to return content from our mock file system
        mockReadFile.mockImplementation((filePath: any) => {
            const pathStr = String(filePath);
            const content = mockFileSystem.get(pathStr);
            if (content !== undefined) {
                return Promise.resolve(content as any);
            }
            return Promise.reject(new Error('ENOENT: no such file or directory'));
        });

        // Mock vscode workspace folder
        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({
            uri: { fsPath: '/project' },
            name: 'test',
            index: 0
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('excludedFolders and config file loading', () => {
        test('should load config from excluded folder if tidyjs.json exists', async () => {
            const excludedFolderPath = '/project/excluded-folder';
            const configPath = path.join(excludedFolderPath, 'tidyjs.json');
            const documentUri = vscode.Uri.file(path.join(excludedFolderPath, 'file.ts'));

            const configContent = {
                groups: [
                    { name: 'ExcludedFolderGroup', match: '^special', order: 1 }
                ],
                excludedFolders: ['node_modules']
            };

            // Add file to mock file system
            mockFileSystem.set(configPath, JSON.stringify(configContent));

            const nearestConfig = await ConfigLoader.findNearestConfigFile(documentUri);
            expect(nearestConfig).toBe(configPath);

            const sources = await ConfigLoader.getConfigForDocument(documentUri);
            expect(sources.length).toBeGreaterThan(0);
            
            const fileSource = sources.find(s => s.type === 'file');
            expect(fileSource).toBeDefined();
            expect(fileSource?.config.groups).toBeDefined();
            expect(fileSource?.config.groups?.[0].name).toBe('ExcludedFolderGroup');
        });

        test('should prioritize local tidyjs.json over excludedFolders setting', async () => {
            const excludedFolderPath = '/project/build';
            const configPath = path.join(excludedFolderPath, 'tidyjs.json');
            const documentUri = vscode.Uri.file(path.join(excludedFolderPath, 'output.js'));

            const localConfig = {
                groups: [
                    { name: 'BuildOutput', match: '^generated', order: 1 }
                ],
                format: {
                    indent: 2,
                    singleQuote: false
                }
            };

            // Add file to mock file system
            mockFileSystem.set(configPath, JSON.stringify(localConfig));

            const sources = await ConfigLoader.getConfigForDocument(documentUri);
            const fileSource = sources.find(s => s.type === 'file');
            
            expect(fileSource).toBeDefined();
            expect(fileSource?.config.format?.indent).toBe(2);
            expect(fileSource?.config.format?.singleQuote).toBe(false);
        });

        test('should handle nested excluded folders with config files', async () => {
            const rootPath = '/project';
            const excludedPath = path.join(rootPath, 'dist');
            const nestedPath = path.join(excludedPath, 'nested');
            
            const rootConfigPath = path.join(rootPath, 'tidyjs.json');
            const nestedConfigPath = path.join(nestedPath, 'tidyjs.json');
            const documentUri = vscode.Uri.file(path.join(nestedPath, 'file.ts'));

            const rootConfig = {
                excludedFolders: ['dist'],
                groups: [
                    { name: 'Root', match: '^@', order: 1 }
                ]
            };

            const nestedConfig = {
                groups: [
                    { name: 'Nested', match: '^nested', order: 1 }
                ]
            };

            // Add files to mock file system
            mockFileSystem.set(rootConfigPath, JSON.stringify(rootConfig));
            mockFileSystem.set(nestedConfigPath, JSON.stringify(nestedConfig));

            const nearestConfig = await ConfigLoader.findNearestConfigFile(documentUri);
            expect(nearestConfig).toBe(nestedConfigPath);

            const sources = await ConfigLoader.getConfigForDocument(documentUri);
            const fileSource = sources.find(s => s.type === 'file');
            
            expect(fileSource?.config.groups?.[0].name).toBe('Nested');
        });
    });

    describe('config hierarchy with excludedFolders', () => {
        test('should inherit excludedFolders from parent config', async () => {
            const parentPath = '/project';
            const childPath = path.join(parentPath, 'src');
            const parentConfigPath = path.join(parentPath, 'tidyjs.json');
            const childConfigPath = path.join(childPath, 'tidyjs.json');
            const documentUri = vscode.Uri.file(path.join(childPath, 'file.ts'));

            const parentConfig = {
                excludedFolders: ['node_modules', 'dist'],
                groups: [
                    { name: 'Parent', match: '^parent', order: 1 }
                ]
            };

            const childConfig = {
                extends: '../tidyjs.json',
                groups: [
                    { name: 'Child', match: '^child', order: 2 }
                ]
            };

            // Add files to mock file system
            mockFileSystem.set(parentConfigPath, JSON.stringify(parentConfig));
            mockFileSystem.set(childConfigPath, JSON.stringify(childConfig));

            const sources = await ConfigLoader.getConfigForDocument(documentUri);
            const fileSource = sources.find(s => s.type === 'file');
            
            expect(fileSource?.config.excludedFolders).toEqual(['node_modules', 'dist']);
            expect(fileSource?.config.groups?.[0].name).toBe('Child');
        });

        test('should override excludedFolders in child config', async () => {
            const parentPath = '/project';
            const childPath = path.join(parentPath, 'src');
            const parentConfigPath = path.join(parentPath, 'tidyjs.json');
            const childConfigPath = path.join(childPath, 'tidyjs.json');
            const documentUri = vscode.Uri.file(path.join(childPath, 'file.ts'));

            const parentConfig = {
                excludedFolders: ['node_modules', 'dist'],
                groups: [
                    { name: 'Parent', match: '^parent', order: 1 }
                ]
            };

            const childConfig = {
                extends: '../tidyjs.json',
                excludedFolders: ['build'],
                groups: [
                    { name: 'Child', match: '^child', order: 2 }
                ]
            };

            // Add files to mock file system
            mockFileSystem.set(parentConfigPath, JSON.stringify(parentConfig));
            mockFileSystem.set(childConfigPath, JSON.stringify(childConfig));

            const sources = await ConfigLoader.getConfigForDocument(documentUri);
            const fileSource = sources.find(s => s.type === 'file');
            
            expect(fileSource?.config.excludedFolders).toEqual(['build']);
        });
    });
});