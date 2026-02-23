import { setLogger } from '@tidyjs/core';
import { resolveFiles } from './git';
import { checkFiles } from './commands/check';
import { fixFiles } from './commands/fix';
import { reportResults } from './reporter';
import type { CheckOptions } from './commands/check';

setLogger({
    debug: () => {},
    error: (msg: string, ...args: unknown[]) => console.error(`[tidyjs] ${msg}`, ...args),
});

function parseArgs(argv: string[]): {
    command: string;
    files: string[];
    configPath?: string;
    quiet: boolean;
    noColor: boolean;
} {
    const args = argv.slice(2);
    let command = 'check';
    const files: string[] = [];
    let configPath: string | undefined;
    let quiet = false;
    let noColor = false;

    let i = 0;
    if (args[0] && !args[0].startsWith('-')) {
        command = args[0];
        i = 1;
    }

    for (; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--config' && args[i + 1]) {
            configPath = args[++i];
        } else if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '--no-color') {
            noColor = true;
        } else if (arg === '--help' || arg === '-h') {
            printHelp();
            process.exit(0);
        } else if (!arg.startsWith('-')) {
            files.push(arg);
        }
    }

    return { command, files, configPath, quiet, noColor };
}

function printHelp(): void {
    console.log(`
Usage: tidyjs-cli [command] [files...] [options]

Commands:
  check   Verify files are properly formatted (default)
  fix     Auto-format non-conforming files

Options:
  --config <path>   Explicit config file path
  --quiet           Suppress file-by-file details
  --no-color        Disable colored output
  -h, --help        Show this help message

If no files are specified, checks git staged files.

Exit codes:
  0  All files conform
  1  Non-conforming files found
  2  Error
`);
}

async function main(): Promise<void> {
    const { command, files, configPath, quiet, noColor } = parseArgs(process.argv);

    if (noColor) {
        process.env.NO_COLOR = '1';
    }

    const resolvedFiles = resolveFiles(files);

    if (resolvedFiles.length === 0) {
        if (!quiet) {
            console.log('No supported files to check.');
        }
        process.exit(0);
    }

    const options: CheckOptions = { configPath };

    try {
        let results;
        if (command === 'fix') {
            results = await fixFiles(resolvedFiles, options);
        } else if (command === 'check') {
            results = await checkFiles(resolvedFiles, options);
        } else {
            console.error(`Unknown command: ${command}`);
            printHelp();
            process.exit(2);
            return;
        }

        reportResults(results, quiet);
        const hasFailures = results.some(r => !r.passed);
        process.exit(hasFailures ? 1 : 0);
    } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(2);
    }
}

main();
