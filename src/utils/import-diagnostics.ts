// Misc
import { ImportType } from '../parser';

// VSCode
import * as vscode from 'vscode';

export interface ImportDiagnostic {
    type: 'unused' | 'missing' | 'conflict' | 'typeOnly' | 'moduleNotFound';
    severity: vscode.DiagnosticSeverity;
    range: vscode.Range;
    message: string;
    code?: string | number;
    source?: string;
    suggestedFix?: {
        action: 'remove' | 'add' | 'convert' | 'rename' | 'fix-path';
        newImport?: string;
        importType?: ImportType;
    };
}

export class ImportDiagnosticsAnalyzer {
    /**
     * Analyze VS Code diagnostics to find import-related issues
     */
    public analyzeImportDiagnostics(
        document: vscode.TextDocument,
        diagnostics: readonly vscode.Diagnostic[]
    ): ImportDiagnostic[] {
        const importDiagnostics: ImportDiagnostic[] = [];

        for (const diagnostic of diagnostics) {
            const importDiag = this.classifyDiagnostic(diagnostic, document);
            if (importDiag) {
                importDiagnostics.push(importDiag);
            }
        }

        return importDiagnostics;
    }

    private classifyDiagnostic(
        diagnostic: vscode.Diagnostic,
        document: vscode.TextDocument
    ): ImportDiagnostic | null {
        // TypeScript: Unused import
        if (diagnostic.code === 6133 || diagnostic.code === 6192) {
            return {
                type: 'unused',
                severity: diagnostic.severity,
                range: diagnostic.range,
                message: diagnostic.message,
                code: diagnostic.code,
                source: diagnostic.source,
                suggestedFix: {
                    action: 'remove'
                }
            };
        }

        // TypeScript: Cannot find name (missing import)
        if (diagnostic.code === 2304 || diagnostic.code === 2552) {
            const missingName = this.extractMissingName(diagnostic.message);
            return {
                type: 'missing',
                severity: diagnostic.severity,
                range: diagnostic.range,
                message: diagnostic.message,
                code: diagnostic.code,
                source: diagnostic.source,
                suggestedFix: {
                    action: 'add',
                    newImport: missingName
                }
            };
        }

        // TypeScript: Module not found
        if (diagnostic.code === 2307) {
            const modulePath = this.extractModulePath(diagnostic.message);
            return {
                type: 'moduleNotFound',
                severity: diagnostic.severity,
                range: diagnostic.range,
                message: diagnostic.message,
                code: diagnostic.code,
                source: diagnostic.source,
                suggestedFix: {
                    action: 'fix-path',
                    newImport: this.suggestCorrectPath(modulePath, document)
                }
            };
        }

        // TypeScript: Import only used as type
        if (diagnostic.code === 1371) {
            return {
                type: 'typeOnly',
                severity: diagnostic.severity,
                range: diagnostic.range,
                message: diagnostic.message,
                code: diagnostic.code,
                source: diagnostic.source,
                suggestedFix: {
                    action: 'convert',
                    importType: ImportType.TYPE_NAMED
                }
            };
        }

        // ESLint: no-unused-vars
        if (diagnostic.source === 'eslint' && 
            (diagnostic.code === 'no-unused-vars' || 
             diagnostic.message.includes('is defined but never used'))) {
            return {
                type: 'unused',
                severity: diagnostic.severity,
                range: diagnostic.range,
                message: diagnostic.message,
                code: typeof diagnostic.code === 'object' ? diagnostic.code.value : diagnostic.code,
                source: diagnostic.source,
                suggestedFix: {
                    action: 'remove'
                }
            };
        }

        return null;
    }

    private extractMissingName(message: string): string {
        // Extract name from "Cannot find name 'useState'"
        const match = message.match(/Cannot find name '([^']+)'/);
        return match ? match[1] : '';
    }

    private extractModulePath(message: string): string {
        // Extract path from "Cannot find module './utils'"
        const match = message.match(/Cannot find module '([^']+)'/);
        return match ? match[1] : '';
    }

    private suggestCorrectPath(modulePath: string, document: vscode.TextDocument): string {
        // Simple path correction suggestions
        if (modulePath.startsWith('../../../')) {
            // Suggest using alias if deep relative import
            return '@/' + modulePath.split('/').pop();
        }
        
        // Add file extension if missing
        if (!modulePath.includes('.')) {
            // Try common extensions
            const extensions = ['.ts', '.tsx', '.js', '.jsx'];
            // In real implementation, check file system
            return modulePath + '.ts';
        }

        return modulePath;
    }

    /**
     * Generate quick fixes for import diagnostics
     */
    public generateQuickFixes(diagnostics: ImportDiagnostic[]): vscode.CodeAction[] {
        const codeActions: vscode.CodeAction[] = [];

        for (const diagnostic of diagnostics) {
            if (diagnostic.suggestedFix) {
                const action = this.createCodeAction(diagnostic);
                if (action) {
                    codeActions.push(action);
                }
            }
        }

        return codeActions;
    }

    private createCodeAction(diagnostic: ImportDiagnostic): vscode.CodeAction | null {
        switch (diagnostic.suggestedFix?.action) {
            case 'remove':
                return this.createRemoveImportAction(diagnostic);
            case 'add':
                return this.createAddImportAction(diagnostic);
            case 'convert':
                return this.createConvertToTypeImportAction(diagnostic);
            case 'fix-path':
                return this.createFixPathAction(diagnostic);
            default:
                return null;
        }
    }

    private createRemoveImportAction(diagnostic: ImportDiagnostic): vscode.CodeAction {
        const action = new vscode.CodeAction(
            `Remove unused import`,
            vscode.CodeActionKind.QuickFix
        );
        action.diagnostics = [this.toDiagnostic(diagnostic)];
        // In real implementation, create WorkspaceEdit to remove the import
        return action;
    }

    private createAddImportAction(diagnostic: ImportDiagnostic): vscode.CodeAction {
        const action = new vscode.CodeAction(
            `Import '${diagnostic.suggestedFix?.newImport}'`,
            vscode.CodeActionKind.QuickFix
        );
        action.diagnostics = [this.toDiagnostic(diagnostic)];
        // In real implementation, create WorkspaceEdit to add the import
        return action;
    }

    private createConvertToTypeImportAction(diagnostic: ImportDiagnostic): vscode.CodeAction {
        const action = new vscode.CodeAction(
            `Convert to type-only import`,
            vscode.CodeActionKind.QuickFix
        );
        action.diagnostics = [this.toDiagnostic(diagnostic)];
        // In real implementation, create WorkspaceEdit to convert import
        return action;
    }

    private createFixPathAction(diagnostic: ImportDiagnostic): vscode.CodeAction {
        const action = new vscode.CodeAction(
            `Change to '${diagnostic.suggestedFix?.newImport}'`,
            vscode.CodeActionKind.QuickFix
        );
        action.diagnostics = [this.toDiagnostic(diagnostic)];
        // In real implementation, create WorkspaceEdit to fix path
        return action;
    }

    private toDiagnostic(importDiag: ImportDiagnostic): vscode.Diagnostic {
        const diag = new vscode.Diagnostic(
            importDiag.range,
            importDiag.message,
            importDiag.severity
        );
        if (importDiag.code) {
            diag.code = importDiag.code;
        }
        if (importDiag.source) {
            diag.source = importDiag.source;
        }
        return diag;
    }
}

/**
 * Integration with TidyJS formatter
 */
export function enhanceFormatterWithDiagnostics(
    document: vscode.TextDocument,
    formattedImports: string
): string {
    const diagnostics = vscode.languages.getDiagnostics(document.uri);
    const analyzer = new ImportDiagnosticsAnalyzer();
    const importDiagnostics = analyzer.analyzeImportDiagnostics(document, diagnostics);

    // Remove unused imports
    const unusedImports = importDiagnostics.filter(d => d.type === 'unused');
    if (unusedImports.length > 0) {
        // Filter out unused imports from formattedImports
        // Implementation depends on your formatter structure
    }

    // Add missing imports
    const missingImports = importDiagnostics.filter(d => d.type === 'missing');
    if (missingImports.length > 0) {
        // Add suggested imports to formattedImports
        // Implementation depends on your formatter structure
    }

    // Convert to type-only imports
    const typeOnlyImports = importDiagnostics.filter(d => d.type === 'typeOnly');
    if (typeOnlyImports.length > 0) {
        // Convert regular imports to type imports in formattedImports
        // Implementation depends on your formatter structure
    }

    return formattedImports;
}