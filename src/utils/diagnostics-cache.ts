/**
 * Cache for VS Code diagnostics to avoid multiple expensive calls
 */

import { Diagnostic, Uri, languages } from 'vscode';
import { perfMonitor } from './performance';

export class DiagnosticsCache {
    private cache = new Map<string, { diagnostics: readonly Diagnostic[]; timestamp: number }>();
    private readonly TTL = 100; // Cache for 100ms during format operation

    /**
     * Get diagnostics with caching
     */
    getDiagnostics(uri: Uri): readonly Diagnostic[] {
        const key = uri.toString();
        const cached = this.cache.get(key);
        
        if (cached && Date.now() - cached.timestamp < this.TTL) {
            return cached.diagnostics;
        }

        const diagnostics = perfMonitor.measureSync(
            'get_diagnostics_from_vscode',
            () => languages.getDiagnostics(uri),
            { uri: key }
        );

        this.cache.set(key, {
            diagnostics,
            timestamp: Date.now()
        });

        return diagnostics;
    }

    /**
     * Clear cache
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Clear specific URI from cache
     */
    clearUri(uri: Uri): void {
        this.cache.delete(uri.toString());
    }
}

// Singleton instance
export const diagnosticsCache = new DiagnosticsCache();