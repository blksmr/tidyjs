import * as path from 'path';
import { spawn } from 'node:child_process';
import { downloadAndUnzipVSCode, runTests, type TestRunFailedError } from '@vscode/test-electron';

type CommandResult = {
    code: number | null;
    signal: NodeJS.Signals | null;
    stdout: string;
    stderr: string;
};

function runCommand(command: string, args: string[]): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        child.on('error', reject);
        child.on('close', (code, signal) => {
            resolve({ code, signal, stdout, stderr });
        });
    });
}

async function ensureMacCodeSignature(vscodeExecutablePath: string): Promise<void> {
    if (process.platform !== 'darwin' || process.env.TIDYJS_E2E_SKIP_CODESIGN_FIX === '1') {
        return;
    }

    const appPath = path.resolve(vscodeExecutablePath, '..', '..', '..');
    const verify = await runCommand('codesign', ['--verify', '--deep', '--strict', appPath]);

    if (verify.code === 0) {
        return;
    }

    console.warn('Detected invalid VS Code signature for E2E app. Applying ad-hoc signature...');

    const resign = await runCommand('codesign', ['--force', '--deep', '--sign', '-', appPath]);
    if (resign.code !== 0) {
        throw new Error(
            `Failed to ad-hoc sign VS Code test app (${appPath}).\n${resign.stderr || resign.stdout}`
        );
    }

    const reverify = await runCommand('codesign', ['--verify', '--deep', '--strict', appPath]);
    if (reverify.code !== 0) {
        throw new Error(
            `VS Code test app signature is still invalid after ad-hoc signing (${appPath}).\n${reverify.stderr || reverify.stdout}`
        );
    }
}

function isSigabrtError(error: unknown): error is TestRunFailedError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'signal' in error &&
        (error as { signal?: string }).signal === 'SIGABRT'
    );
}

async function main(): Promise<void> {
    try {
        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = process.cwd();

        // The path to the test suite (compiled output, relative to this file)
        const extensionTestsPath = path.resolve(import.meta.dirname, './suite/index.js');

        // Create a test workspace (source fixtures, relative to project root)
        const testWorkspace = path.resolve(process.cwd(), 'test/e2e/fixtures');
        const vscodeVersion = process.env.VSCODE_E2E_VERSION ?? '1.100.3';
        const vscodeExecutablePath =
            process.env.VSCODE_E2E_EXECUTABLE ?? (await downloadAndUnzipVSCode(vscodeVersion));

        await ensureMacCodeSignature(vscodeExecutablePath);

        // Download VS Code, unzip it and run the integration test
        await runTests({
            vscodeExecutablePath,
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                testWorkspace, // Open test workspace
                '--disable-extensions', // Keep E2E stable: suite validates VS Code APIs, not installed extensions
                '--disable-gpu', // Disable GPU acceleration for CI environments
                '--skip-welcome',
                '--skip-release-notes'
            ]
        });
    } catch (err: unknown) {
        if (process.platform === 'darwin' && isSigabrtError(err)) {
            console.error(
                [
                    'VS Code/Electron crashed with SIGABRT before tests could run.',
                    'This often looks like an E2E hang on macOS because a crash dialog can stay open.',
                    'Try deleting .vscode-test installs and rerun, or set VSCODE_E2E_EXECUTABLE to a known-good VS Code app.'
                ].join('\n')
            );
        }
        console.error('Failed to run tests:', err);
        process.exit(1);
    }
}

main();
