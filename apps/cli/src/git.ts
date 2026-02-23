import { execSync } from 'child_process';
import * as path from 'path';

const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

export function filterSupportedFiles(files: string[]): string[] {
    return files.filter(f => SUPPORTED_EXTENSIONS.has(path.extname(f)));
}

export function getGitStagedFiles(): string[] {
    try {
        const output = execSync('git diff --cached --name-only --diff-filter=ACMR', {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return output.trim().split('\n').filter(Boolean);
    } catch {
        return [];
    }
}

export function resolveFiles(args: string[]): string[] {
    const files = args.length > 0 ? args : getGitStagedFiles();
    return filterSupportedFiles(files);
}
