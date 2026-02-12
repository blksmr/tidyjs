import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

describe('TidyJS Multiline Comment Bug E2E Tests', () => {
    const testWorkspaceDir = vscode.workspace.workspaceFolders![0].uri.fsPath;
    let extension: vscode.Extension<any> | undefined;

    before(async () => {
        // Ensure fixtures directory exists
        if (!fs.existsSync(testWorkspaceDir)) {
            fs.mkdirSync(testWorkspaceDir, { recursive: true });
        }

        // Wait for VS Code and extensions to initialize
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Get the TidyJS extension
        extension = vscode.extensions.getExtension('Asmir.tidyjs') ||
                   vscode.extensions.all.find(ext =>
                       ext.id.includes('tidyjs') ||
                       ext.packageJSON?.name === 'tidyjs' ||
                       ext.packageJSON?.displayName === 'TidyJS'
                   );

        if (extension && !extension.isActive) {
            await extension.activate();
        }
    });

    afterEach(async () => {
        // Close all editors
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    });

    it('should handle file starting with multiline comment correctly', async function() {
        if (!extension) {
            this.skip();
            return;
        }
        // Use .tsx so JSX content parses correctly
        const testFilePath = path.join(testWorkspaceDir, 'test-multiline-comment.tsx');

        // Create test content with multiline comment at the beginning
        const testContent = `/*
 * This is a multiline comment at the beginning of the file
 * It should be preserved and imports should be placed after it
 * properly formatted
 */
import { useState } from 'react';
import Button from '@app/components/Button';
import React from 'react';
import { FC } from 'react';

const MyComponent: FC = () => {
    const [count, setCount] = useState(0);
    return <Button onClick={() => setCount(count + 1)}>Count: {count}</Button>;
};

export default MyComponent;`;

        // Write test file
        fs.writeFileSync(testFilePath, testContent);

        // Open the document
        const document = await vscode.workspace.openTextDocument(testFilePath);
        const editor = await vscode.window.showTextDocument(document);

        // Execute format command
        await vscode.commands.executeCommand('tidyjs.forceFormatDocument');

        // Wait for formatting to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get the formatted content
        const formattedContent = editor.document.getText();

        // Verify the multiline comment is preserved
        assert.ok(
            formattedContent.startsWith('/*'),
            'Multiline comment at the beginning should be preserved'
        );

        // Verify imports were actually formatted (content should change)
        assert.notStrictEqual(
            formattedContent,
            testContent,
            'Formatter should have reorganized the imports'
        );

        // Verify the group comment is present
        assert.ok(
            formattedContent.includes('// Other'),
            'Other group comment should be present'
        );

        // Verify the code body is preserved after imports
        assert.ok(
            formattedContent.includes('const MyComponent'),
            'Code body should be preserved after imports'
        );

        // Clean up
        fs.unlinkSync(testFilePath);
    });

    it('should handle file with only multiline comment and imports', async function() {
        if (!extension) {
            this.skip();
            return;
        }
        const testFilePath = path.join(testWorkspaceDir, 'test-only-comment-imports.ts');

        // Create test content with ONLY multiline comment and imports
        const testContent = `/*
 * File header comment
 */
import { FC } from 'react';
import React from 'react';`;

        // Write test file
        fs.writeFileSync(testFilePath, testContent);

        // Open and format
        const document = await vscode.workspace.openTextDocument(testFilePath);
        const editor = await vscode.window.showTextDocument(document);
        await vscode.commands.executeCommand('tidyjs.forceFormatDocument');
        await new Promise(resolve => setTimeout(resolve, 1000));

        const formattedContent = editor.document.getText();

        // Verify structure
        assert.ok(
            formattedContent.startsWith('/*'),
            'Comment should be preserved at the beginning'
        );

        assert.ok(
            formattedContent.includes('// Other'),
            'Import group comment should be added'
        );

        // Clean up
        fs.unlinkSync(testFilePath);
    });

    it('should handle edge case with comment immediately before imports', async function() {
        if (!extension) {
            this.skip();
            return;
        }
        const testFilePath = path.join(testWorkspaceDir, 'test-comment-immediate-imports.ts');

        // No blank line between comment and imports
        const testContent = `/* Copyright notice */
import React from 'react';
import { useState } from 'react';`;

        // Write and format
        fs.writeFileSync(testFilePath, testContent);
        const document = await vscode.workspace.openTextDocument(testFilePath);
        const editor = await vscode.window.showTextDocument(document);
        await vscode.commands.executeCommand('tidyjs.forceFormatDocument');
        await new Promise(resolve => setTimeout(resolve, 1000));

        const formattedContent = editor.document.getText();

        // Block comment header should be preserved
        assert.ok(
            formattedContent.includes('/* Copyright notice */'),
            'Block comment should be preserved'
        );

        // Imports should be formatted with group comment
        assert.ok(
            formattedContent.includes('// Other'),
            'Group comment should be present after header comment'
        );

        // Clean up
        fs.unlinkSync(testFilePath);
    });
});
