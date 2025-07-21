import { describe, expect, test, beforeEach, afterEach, jest } from '@jest/globals';
import { ConfigLoader } from '../../src/utils/configLoader';
import { configManager } from '../../src/utils/config';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

jest.mock('fs');
jest.mock('../../src/utils/log');

describe('ConfigLoader - excludedFolders interaction', () => {
    const mockFs = fs as jest.Mocked<typeof fs>;
    const mockFsPromises = fs.promises as jest.Mocked<typeof fs.promises>;

    beforeEach(() => {
        jest.clearAllMocks();
        ConfigLoader['configCache'].clear();
        
        mockFsPromises.access = jest.fn().mockImplementation((filePath: string) => {
            if (filePath.includes('tidyjs.json')) {
                return Promise.resolve();
            }
            return Promise.reject(new Error('File not found'));
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

            mockFsPromises.readFile = jest.fn().mockResolvedValue(JSON.stringify(configContent));

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

            mockFsPromises.readFile = jest.fn().mockResolvedValue(JSON.stringify(localConfig));

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

            mockFsPromises.access = jest.fn().mockImplementation((filePath: string) => {
                if (filePath === rootConfigPath || filePath === nestedConfigPath) {
                    return Promise.resolve();
                }
                return Promise.reject(new Error('File not found'));
            });

            mockFsPromises.readFile = jest.fn().mockImplementation((filePath: string) => {
                if (filePath === rootConfigPath) {
                    return Promise.resolve(JSON.stringify(rootConfig));
                } else if (filePath === nestedConfigPath) {
                    return Promise.resolve(JSON.stringify(nestedConfig));
                }
                return Promise.reject(new Error('File not found'));
            });

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

            mockFsPromises.access = jest.fn().mockImplementation((filePath: string) => {
                if (filePath === parentConfigPath || filePath === childConfigPath) {
                    return Promise.resolve();
                }
                return Promise.reject(new Error('File not found'));
            });

            mockFsPromises.readFile = jest.fn().mockImplementation((filePath: string) => {
                if (filePath === parentConfigPath) {
                    return Promise.resolve(JSON.stringify(parentConfig));
                } else if (filePath === childConfigPath) {
                    return Promise.resolve(JSON.stringify(childConfig));
                }
                return Promise.reject(new Error('File not found'));
            });

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

            mockFsPromises.access = jest.fn().mockImplementation((filePath: string) => {
                if (filePath === parentConfigPath || filePath === childConfigPath) {
                    return Promise.resolve();
                }
                return Promise.reject(new Error('File not found'));
            });

            mockFsPromises.readFile = jest.fn().mockImplementation((filePath: string) => {
                if (filePath === parentConfigPath) {
                    return Promise.resolve(JSON.stringify(parentConfig));
                } else if (filePath === childConfigPath) {
                    return Promise.resolve(JSON.stringify(childConfig));
                }
                return Promise.reject(new Error('File not found'));
            });

            const sources = await ConfigLoader.getConfigForDocument(documentUri);
            const fileSource = sources.find(s => s.type === 'file');
            
            expect(fileSource?.config.excludedFolders).toEqual(['build']);
        });
    });
});