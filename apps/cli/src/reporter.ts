export interface FileResult {
    filePath: string;
    issues: string[];
    passed: boolean;
}

export type ReportMode = 'check' | 'fix';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function useColor(): boolean {
    return process.env.NO_COLOR === undefined && process.stdout.isTTY !== false;
}

export function reportResults(results: FileResult[], quiet: boolean, mode: ReportMode = 'check'): void {
    const color = useColor();
    const failed = results.filter(r => !r.passed);

    if (!quiet) {
        for (const result of results) {
            if (result.passed) {
                const prefix = color ? `${GREEN}ok${RESET}` : 'ok';
                console.log(`${prefix} ${result.filePath}`);
            } else {
                const label = mode === 'fix' ? 'FIXED' : 'FAIL';
                const labelColor = mode === 'fix' ? YELLOW : RED;
                const prefix = color ? `${labelColor}${label}${RESET}` : label;
                const issues = result.issues.join(', ');
                console.log(`${prefix} ${result.filePath} — ${issues}`);
            }
        }
        console.log();
    }

    if (failed.length === 0) {
        const msg = `All ${results.length} file${results.length > 1 ? 's' : ''} properly formatted.`;
        console.log(color ? `${GREEN}${BOLD}${msg}${RESET}` : msg);
    } else if (mode === 'fix') {
        const msg = `${failed.length} file${failed.length > 1 ? 's' : ''} fixed.`;
        console.log(color ? `${YELLOW}${BOLD}${msg}${RESET}` : msg);
    } else {
        const msg = `${failed.length} file${failed.length > 1 ? 's' : ''} need formatting (use 'fix' to auto-format)`;
        console.log(color ? `${RED}${BOLD}${msg}${RESET}` : msg);
    }
}
