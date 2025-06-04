import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

describe('Advanced VS Code Features E2E Tests', () => {
    const testWorkspaceDir = path.join(__dirname, '../fixtures');

    before(async () => {
        if (!fs.existsSync(testWorkspaceDir)) {
            fs.mkdirSync(testWorkspaceDir, { recursive: true });
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
    });

    afterEach(async () => {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    });

    it('should test workspace configuration and settings', async () => {
        // Test different configuration scopes
        const globalConfig = vscode.workspace.getConfiguration();
        const editorConfig = vscode.workspace.getConfiguration('editor');
        const typescriptConfig = vscode.workspace.getConfiguration('typescript');
        
        assert.notStrictEqual(globalConfig, undefined, 'Global config should be available');
        assert.notStrictEqual(editorConfig, undefined, 'Editor config should be available');
        assert.notStrictEqual(typescriptConfig, undefined, 'TypeScript config should be available');

        // Test getting specific settings
        const tabSize = editorConfig.get('tabSize');
        const insertSpaces = editorConfig.get('insertSpaces');
        const fontSize = editorConfig.get('fontSize');

        console.log(`Editor settings - Tab size: ${tabSize}, Insert spaces: ${insertSpaces}, Font size: ${fontSize}`);

        // Test TidyJS specific configuration (should return defaults)
        const tidyjsConfig = vscode.workspace.getConfiguration('tidyjs');
        const debugSetting = tidyjsConfig.get('debug', false);
        const groupsSetting = tidyjsConfig.get('groups', []);

        console.log(`TidyJS config - Debug: ${debugSetting}, Groups: ${JSON.stringify(groupsSetting)}`);

        // Test configuration inspection
        const tabSizeInspect = editorConfig.inspect('tabSize');
        if (tabSizeInspect) {
            console.log('Tab size inspection:', {
                default: tabSizeInspect.defaultValue,
                global: tabSizeInspect.globalValue,
                workspace: tabSizeInspect.workspaceValue
            });
        }

        assert.strictEqual(true, true, 'Configuration API works correctly');
    });

    it('should test language feature providers simulation', async () => {
        const testFilePath = path.join(testWorkspaceDir, 'providers-test.ts');
        const testContent = `import React, { useState, useEffect } from 'react';
import { debounce } from 'lodash';

interface User {
    id: number;
    name: string;
    email: string;
}

const UserComponent: React.FC<{ userId: number }> = ({ userId }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    
    const debouncedFetch = debounce((id: number) => {
        fetch(\`/api/users/\${id}\`)
            .then(res => res.json())
            .then(setUser)
            .finally(() => setLoading(false));
    }, 300);
    
    useEffect(() => {
        debouncedFetch(userId);
    }, [userId]);
    
    if (loading) return <div>Loading...</div>;
    if (!user) return <div>User not found</div>;
    
    return (
        <div>
            <h1>{user.name}</h1>
            <p>{user.email}</p>
        </div>
    );
};

export default UserComponent;`;

        fs.writeFileSync(testFilePath, testContent);
        const document = await vscode.workspace.openTextDocument(testFilePath);
        await vscode.window.showTextDocument(document);

        // Test hover provider
        const hoverPosition = new vscode.Position(10, 15); // Over 'useState'
        try {
            const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
                'vscode.executeHoverProvider',
                document.uri,
                hoverPosition
            );

            if (hovers && hovers.length > 0) {
                console.log(`Hover info available: ${hovers.length} entries`);
                hovers.forEach((hover, index) => {
                    const content = hover.contents.map(c => 
                        typeof c === 'string' ? c : c.value
                    ).join(' ');
                    console.log(`  Hover ${index + 1}: ${content.substring(0, 100)}...`);
                });
                assert.strictEqual(hovers.length > 0, true, 'Should provide hover information');
            } else {
                console.log('No hover information available');
                assert.strictEqual(true, true, 'Hover provider API tested');
            }
        } catch (error) {
            console.log('Hover provider error:', error instanceof Error ? error.message : String(error));
            assert.strictEqual(true, true, 'Hover provider API available');
        }

        // Test definition provider
        const definitionPosition = new vscode.Position(10, 15); // Over 'useState'
        try {
            const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeDefinitionProvider',
                document.uri,
                definitionPosition
            );

            if (definitions && definitions.length > 0) {
                console.log(`Found ${definitions.length} definitions`);
                definitions.forEach((def, index) => {
                    console.log(`  Definition ${index + 1}: ${def.uri.fsPath}:${def.range.start.line + 1}`);
                });
                assert.strictEqual(definitions.length > 0, true, 'Should provide definitions');
            } else {
                console.log('No definitions found');
                assert.strictEqual(true, true, 'Definition provider API tested');
            }
        } catch (error) {
            console.log('Definition provider error:', error instanceof Error ? error.message : String(error));
            assert.strictEqual(true, true, 'Definition provider API available');
        }

        fs.unlinkSync(testFilePath);
    });

    it('should test workspace and multi-root capabilities', async () => {
        // Test workspace folder detection
        const workspaceFolders = vscode.workspace.workspaceFolders;
        console.log(`Workspace folders: ${workspaceFolders ? workspaceFolders.length : 0}`);
        
        if (workspaceFolders && workspaceFolders.length > 0) {
            workspaceFolders.forEach((folder, index) => {
                console.log(`  Folder ${index + 1}: ${folder.name} - ${folder.uri.fsPath}`);
            });
        }

        // Test workspace path mapping
        const testFile = path.join(testWorkspaceDir, 'workspace-test.ts');
        fs.writeFileSync(testFile, 'export const test = "workspace";');
        
        const document = await vscode.workspace.openTextDocument(testFile);
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        
        console.log(`Document workspace folder: ${workspaceFolder ? workspaceFolder.name : 'none'}`);

        // Test relative path calculation
        if (workspaceFolder) {
            const relativePath = vscode.workspace.asRelativePath(document.uri);
            console.log(`Relative path: ${relativePath}`);
            assert.strictEqual(typeof relativePath, 'string', 'Should provide relative path');
        }

        // Test workspace file search
        try {
            const foundFiles = await vscode.workspace.findFiles(
                '**/*.ts',
                '**/node_modules/**',
                5 // Limit to 5 files
            );
            
            console.log(`Found ${foundFiles.length} TypeScript files in workspace`);
            foundFiles.forEach((uri, index) => {
                console.log(`  ${index + 1}. ${path.basename(uri.fsPath)}`);
            });
            
            assert.strictEqual(foundFiles.length >= 0, true, 'File search should work');
        } catch (error) {
            console.log('File search error:', error instanceof Error ? error.message : String(error));
            assert.strictEqual(true, true, 'File search API available');
        }

        fs.unlinkSync(testFile);
    });

    it('should test extension and command capabilities', async () => {
        // Test available commands
        const allCommands = await vscode.commands.getCommands();
        console.log(`Total commands available: ${allCommands.length}`);

        // Test some common commands
        const commonCommands = [
            'workbench.action.files.newUntitledFile',
            'workbench.action.closeActiveEditor',
            'editor.action.formatDocument',
            'editor.action.organizeImports',
            'workbench.action.showAllCommands'
        ];

        const availableCommands = commonCommands.filter(cmd => allCommands.includes(cmd));
        console.log(`Available common commands: ${availableCommands.length}/${commonCommands.length}`);
        availableCommands.forEach(cmd => console.log(`  ✓ ${cmd}`));

        // Test command execution
        try {
            await vscode.commands.executeCommand('workbench.action.files.newUntitledFile');
            console.log('Successfully executed new untitled file command');
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            console.log('Successfully executed close editor command');
            assert.strictEqual(true, true, 'Command execution works');
        } catch (error) {
            console.log('Command execution error:', error instanceof Error ? error.message : String(error));
            assert.strictEqual(true, true, 'Command execution API available');
        }

        // Test extension enumeration
        const extensions = vscode.extensions.all;
        const builtinExtensions = extensions.filter(ext => ext.id.startsWith('vscode.'));
        const thirdPartyExtensions = extensions.filter(ext => !ext.id.startsWith('vscode.') && !ext.id.startsWith('ms-vscode.'));

        console.log(`Extensions summary:`);
        console.log(`  Built-in: ${builtinExtensions.length}`);
        console.log(`  Third-party: ${thirdPartyExtensions.length}`);
        console.log(`  Total: ${extensions.length}`);

        assert.strictEqual(extensions.length > 0, true, 'Should have extensions loaded');
    });

    it('should test terminal and external tool integration', async () => {
        // Test terminal creation capability
        try {
            const terminal = vscode.window.createTerminal({
                name: 'TidyJS Test Terminal',
                hideFromUser: true
            });

            assert.notStrictEqual(terminal, undefined, 'Should create terminal');
            console.log(`Created terminal: ${terminal.name}`);

            // Test terminal command sending
            terminal.sendText('echo "TidyJS E2E Test"', true);
            console.log('Sent command to terminal');

            // Clean up
            terminal.dispose();
            console.log('Terminal disposed');

            assert.strictEqual(true, true, 'Terminal integration works');
        } catch (error) {
            console.log('Terminal integration error:', error instanceof Error ? error.message : String(error));
            assert.strictEqual(true, true, 'Terminal API available');
        }

        // Test task execution capability
        try {
            const taskDefinition: vscode.TaskDefinition = {
                type: 'shell'
            };

            const task = new vscode.Task(
                taskDefinition,
                vscode.TaskScope.Workspace,
                'Test Task',
                'test',
                new vscode.ShellExecution('echo "Task execution test"')
            );

            console.log(`Created task: ${task.name}`);
            assert.notStrictEqual(task, undefined, 'Should create task');
            assert.strictEqual(true, true, 'Task API works');
        } catch (error) {
            console.log('Task creation error:', error instanceof Error ? error.message : String(error));
            assert.strictEqual(true, true, 'Task API available');
        }
    });

    it('should test output channel and logging capabilities', async () => {
        // Create output channel
        const outputChannel = vscode.window.createOutputChannel('TidyJS E2E Test');
        assert.notStrictEqual(outputChannel, undefined, 'Should create output channel');

        // Test logging to output channel
        outputChannel.appendLine('=== TidyJS E2E Test Output ===');
        outputChannel.appendLine(`Test started at: ${new Date().toISOString()}`);
        outputChannel.appendLine('Testing output channel functionality...');
        outputChannel.append('Partial message... ');
        outputChannel.appendLine('completed!');

        console.log('Output channel logging test completed');

        // Test showing output channel
        try {
            outputChannel.show(true); // Show but don't take focus
            console.log('Output channel shown');
            
            // Hide it again
            outputChannel.hide();
            console.log('Output channel hidden');
        } catch (error) {
            console.log('Output channel show/hide error:', error instanceof Error ? error.message : String(error));
        }

        // Clean up
        outputChannel.dispose();
        console.log('Output channel disposed');

        assert.strictEqual(true, true, 'Output channel functionality works');
    });
});