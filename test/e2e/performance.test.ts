import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

describe('Performance E2E Tests', () => {
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

    it('should handle large files efficiently', async () => {
        const testFilePath = path.join(testWorkspaceDir, 'large-file.ts');
        
        // Generate a large file with many imports
        const imports = Array.from({ length: 100 }, (_, i) => {
            const types = [
                `import React${i} from 'react-${i}';`,
                `import { Component${i}, useState${i} } from 'library-${i}';`,
                `import * as Utils${i} from 'utils-${i}';`,
                `import type { Type${i} } from 'types-${i}';`,
                `import './styles-${i}.css';`
            ];
            return types[i % types.length];
        });

        const largeContent = `${imports.join('\n')}\n\n// Large component with many dependencies\nconst LargeComponent = () => {\n  return <div>Large component</div>;\n};\n\nexport default LargeComponent;`;

        console.log(`Generating file with ${imports.length} imports...`);
        
        const startWrite = performance.now();
        fs.writeFileSync(testFilePath, largeContent);
        const writeTime = performance.now() - startWrite;
        
        console.log(`File write time: ${writeTime.toFixed(2)}ms`);
        
        const startRead = performance.now();
        const document = await vscode.workspace.openTextDocument(testFilePath);
        const readTime = performance.now() - startRead;
        
        console.log(`Document load time: ${readTime.toFixed(2)}ms`);
        
        const startShow = performance.now();
        await vscode.window.showTextDocument(document);
        const showTime = performance.now() - startShow;
        
        console.log(`Document show time: ${showTime.toFixed(2)}ms`);

        // Analyze the document
        const startAnalysis = performance.now();
        const content = document.getText();
        const lines = content.split('\n');
        const importLines = lines.filter(line => line.trim().startsWith('import'));
        const analysisTime = performance.now() - startAnalysis;
        
        console.log(`Analysis time: ${analysisTime.toFixed(2)}ms for ${importLines.length} imports`);
        
        // Performance assertions
        assert.strictEqual(writeTime < 1000, true, 'File write should be under 1 second');
        assert.strictEqual(readTime < 2000, true, 'Document load should be under 2 seconds');
        assert.strictEqual(showTime < 3000, true, 'Document show should be under 3 seconds');
        assert.strictEqual(analysisTime < 100, true, 'Analysis should be under 100ms');
        assert.strictEqual(importLines.length, imports.length, 'Should detect all imports');

        fs.unlinkSync(testFilePath);
    });

    it('should handle multiple documents concurrently', async () => {
        const fileCount = 10;
        const files: Array<{ path: string; document: vscode.TextDocument }> = [];

        console.log(`Creating ${fileCount} concurrent documents...`);
        
        const startTime = performance.now();

        // Create multiple files concurrently
        const createPromises = Array.from({ length: fileCount }, async (_, i) => {
            const filePath = path.join(testWorkspaceDir, `concurrent-${i}.ts`);
            const content = `import React from 'react';\nimport { useState, useEffect } from 'react';\nimport { Component${i} } from 'component-${i}';\n\nconst Test${i} = () => {\n  const [state${i}, setState${i}] = useState(0);\n  return <div>{state${i}}</div>;\n};\n\nexport default Test${i};`;
            
            fs.writeFileSync(filePath, content);
            const document = await vscode.workspace.openTextDocument(filePath);
            return { path: filePath, document };
        });

        const results = await Promise.all(createPromises);
        files.push(...results);
        
        const loadTime = performance.now() - startTime;
        console.log(`Concurrent load time: ${loadTime.toFixed(2)}ms for ${fileCount} files`);

        // Analyze all documents concurrently
        const analysisStart = performance.now();
        const analysisPromises = files.map(async file => {
            const content = file.document.getText();
            const importLines = content.split('\n').filter(line => line.trim().startsWith('import'));
            return { file: path.basename(file.path), imports: importLines.length };
        });

        const analysisResults = await Promise.all(analysisPromises);
        const analysisTime = performance.now() - analysisStart;
        
        console.log(`Concurrent analysis time: ${analysisTime.toFixed(2)}ms`);
        analysisResults.forEach(result => {
            console.log(`  ${result.file}: ${result.imports} imports`);
        });

        // Performance assertions
        assert.strictEqual(loadTime < 5000, true, 'Concurrent load should be under 5 seconds');
        assert.strictEqual(analysisTime < 500, true, 'Concurrent analysis should be under 500ms');
        assert.strictEqual(files.length, fileCount, 'Should create all files');

        // Clean up
        files.forEach(file => {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        });
    });

    it('should measure memory usage patterns', async () => {
        const testFilePath = path.join(testWorkspaceDir, 'memory-test.ts');
        
        // Check initial memory if available
        const getMemoryUsage = () => {
            if (typeof (global as any).gc === 'function') {
                (global as any).gc();
            }
            return process.memoryUsage();
        };

        const initialMemory = getMemoryUsage();
        console.log('Initial memory usage:', {
            heapUsed: `${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(initialMemory.heapTotal / 1024 / 1024)}MB`,
            external: `${Math.round(initialMemory.external / 1024 / 1024)}MB`
        });

        // Create and process multiple documents
        const documents: vscode.TextDocument[] = [];
        
        for (let i = 0; i < 20; i++) {
            const content = `import React${i} from 'react';\n`.repeat(50) + 
                           `\nconst Component${i} = () => <div>Test ${i}</div>;\nexport default Component${i};`;
            
            const filePath = `${testFilePath}-${i}.ts`;
            fs.writeFileSync(filePath, content);
            
            const document = await vscode.workspace.openTextDocument(filePath);
            documents.push(document);
            
            // Measure memory every 5 documents
            if (i % 5 === 4) {
                const currentMemory = getMemoryUsage();
                const heapIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
                console.log(`After ${i + 1} documents - Heap increase: ${Math.round(heapIncrease / 1024 / 1024)}MB`);
            }
        }

        const finalMemory = getMemoryUsage();
        const totalHeapIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        
        console.log('Final memory usage:', {
            heapUsed: `${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`,
            increase: `${Math.round(totalHeapIncrease / 1024 / 1024)}MB`,
            perDocument: `${Math.round(totalHeapIncrease / documents.length / 1024)}KB`
        });

        // Memory assertions (generous limits for test environment)
        assert.strictEqual(totalHeapIncrease < 100 * 1024 * 1024, true, 'Memory increase should be under 100MB');
        assert.strictEqual(documents.length, 20, 'Should create all documents');

        // Clean up
        documents.forEach((_, i) => {
            const filePath = `${testFilePath}-${i}.ts`;
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        });
    });

    it('should benchmark text operations', async () => {
        const testFilePath = path.join(testWorkspaceDir, 'benchmark-text.ts');
        const baseContent = Array.from({ length: 1000 }, (_, i) => 
            `import { function${i} } from 'module-${i}';`
        ).join('\n');

        fs.writeFileSync(testFilePath, baseContent);
        const document = await vscode.workspace.openTextDocument(testFilePath);
        const editor = await vscode.window.showTextDocument(document);

        console.log('Benchmarking text operations...');

        // Benchmark text reading
        const readStart = performance.now();
        for (let i = 0; i < 100; i++) {
            const content = document.getText();
            const lines = content.split('\n');
            assert.strictEqual(lines.length > 0, true);
        }
        const readTime = performance.now() - readStart;
        console.log(`Text reading (100x): ${readTime.toFixed(2)}ms (${(readTime / 100).toFixed(2)}ms per read)`);

        // Benchmark line analysis
        const analysisStart = performance.now();
        for (let i = 0; i < 50; i++) {
            const content = document.getText();
            const importLines = content.split('\n').filter(line => line.trim().startsWith('import'));
            const namedImports = importLines.filter(line => line.includes('{'));
            const defaultImports = importLines.filter(line => !line.includes('{') && line.includes('from'));
            assert.strictEqual(importLines.length > 0, true);
        }
        const analysisTime = performance.now() - analysisStart;
        console.log(`Import analysis (50x): ${analysisTime.toFixed(2)}ms (${(analysisTime / 50).toFixed(2)}ms per analysis)`);

        // Benchmark selections
        const selectionStart = performance.now();
        for (let i = 0; i < 100; i++) {
            const randomLine = Math.floor(Math.random() * document.lineCount);
            const position = new vscode.Position(randomLine, 0);
            editor.selection = new vscode.Selection(position, position);
        }
        const selectionTime = performance.now() - selectionStart;
        console.log(`Selection changes (100x): ${selectionTime.toFixed(2)}ms (${(selectionTime / 100).toFixed(2)}ms per selection)`);

        // Performance assertions
        assert.strictEqual(readTime / 100 < 10, true, 'Average read time should be under 10ms');
        assert.strictEqual(analysisTime / 50 < 20, true, 'Average analysis time should be under 20ms');
        assert.strictEqual(selectionTime / 100 < 5, true, 'Average selection time should be under 5ms');

        fs.unlinkSync(testFilePath);
    });

    it('should test responsiveness under load', async () => {
        console.log('Testing editor responsiveness under load...');
        
        const testFilePath = path.join(testWorkspaceDir, 'responsiveness-test.ts');
        const content = Array.from({ length: 500 }, (_, i) => 
            `import { item${i}, helper${i}, util${i} } from 'package-${i}';`
        ).join('\n') + '\n\n' + Array.from({ length: 100 }, (_, i) => 
            `const function${i} = () => { console.log('test ${i}'); };`
        ).join('\n');

        fs.writeFileSync(testFilePath, content);
        const document = await vscode.workspace.openTextDocument(testFilePath);
        const editor = await vscode.window.showTextDocument(document);

        // Simulate rapid user interactions
        const interactions = [
            () => editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(10, 0)),
            () => editor.selection = new vscode.Selection(new vscode.Position(100, 0), new vscode.Position(110, 0)),
            () => document.getText().split('\n').filter(line => line.includes('import')),
            () => vscode.commands.executeCommand('editor.action.selectAll'),
            () => vscode.commands.executeCommand('cursorMove', { to: 'down', by: 'line', value: 10 })
        ];

        const startTime = performance.now();
        const promises: Promise<any>[] = [];

        // Execute interactions rapidly
        for (let i = 0; i < 20; i++) {
            const interaction = interactions[i % interactions.length];
            promises.push(Promise.resolve(interaction()));
            
            // Add small delays to simulate real usage
            if (i % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        await Promise.all(promises);
        const totalTime = performance.now() - startTime;

        console.log(`Completed 20 rapid interactions in ${totalTime.toFixed(2)}ms`);
        console.log(`Average interaction time: ${(totalTime / 20).toFixed(2)}ms`);

        // Verify editor is still responsive
        const finalSelection = editor.selection;
        const finalContent = document.getText();
        
        assert.strictEqual(finalContent.length > 0, true, 'Document should retain content');
        assert.notStrictEqual(finalSelection, undefined, 'Selection should be valid');
        assert.strictEqual(totalTime < 5000, true, 'All interactions should complete under 5 seconds');

        fs.unlinkSync(testFilePath);
    });
});