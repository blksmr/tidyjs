/**
 * E2E Path Resolution Round-Trip Test
 *
 * Tests that converting relative → absolute → relative produces the same result.
 * Runs on the real Yeap-UI-Apps/apps/paye codebase.
 *
 * Usage:
 *   npx jest test/unit/batch-path-conversion.test.ts --no-coverage --verbose --testTimeout=600000
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

import { discoverFiles, formatSingleFile } from '../../src/batch-formatter';
import { ImportParser } from '@tidyjs/core';

import type { Config } from '@tidyjs/core';

// --- Configuration ---

const PAYE_DIR = '/Users/belkicasmir/Documents/GitHub/work/Yeap-UI-Apps/apps/paye';
const WORKSPACE_ROOT = PAYE_DIR;
const YEAP_ROOT = '/Users/belkicasmir/Documents/GitHub/work/Yeap-UI-Apps';

function makeConfig(mode: 'relative' | 'absolute'): Config {
    return {
        groups: [
            { name: 'Styles', order: 0, match: /^.+\.css$/ },
            { name: 'Misc', order: 1, default: true, priority: 999, match: /^(react|react-.*|lodash|date-fns|classnames|@fortawesome|@reach|uuid|@tanstack|ag-grid-community|framer-motion)$/ },
            { name: '@app/fixtures', order: 2, match: /^@app\/fixtures/ },
            { name: 'DS', order: 3, match: /^ds$/ },
            { name: '@app/dossier', order: 4, match: /^@app\/dossier/ },
            { name: '@app/notification', order: 5, match: /^@app\/notification/ },
            { name: '@app/client', order: 6, match: /^@app\/client/ },
            { name: '@app/admin', order: 7, match: /^@app\/admin/ },
            { name: '@core', order: 8, match: /^@core/ },
            { name: '@library', order: 9, match: /^@library/ },
            { name: 'Utils', order: 10, match: /^yutils/ },
        ],
        importOrder: { default: 0, named: 1, typeOnly: 2, sideEffect: 3 },
        format: {
            sortExports: true,
            sortEnumMembers: true,
            removeUnusedImports: true,
            sortClassProperties: true,
            removeMissingModules: true,
            sortSpecifiers: 'length',
        },
        pathResolution: {
            mode,
        },
        excludedFolders: [],
    };
}

// --- Helpers ---

interface ConversionResult {
    total: number;
    changed: number;
    unchanged: number;
    noImports: number;
    errors: number;
    changedFiles: string[];
    errorFiles: { file: string; error: string }[];
}

async function runBatchFormat(
    files: string[],
    config: Config,
    workspaceRoot: string,
    label: string
): Promise<ConversionResult> {
    const parserCache = new Map<string, ImportParser>();
    const result: ConversionResult = {
        total: files.length,
        changed: 0,
        unchanged: 0,
        noImports: 0,
        errors: 0,
        changedFiles: [],
        errorFiles: [],
    };

    try {
        for (let i = 0; i < files.length; i++) {
            const filePath = files[i];
            const rel = path.relative(PAYE_DIR, filePath);

            const formatResult = await formatSingleFile(filePath, config, parserCache, workspaceRoot);

            if (formatResult.error) {
                result.errors++;
                result.errorFiles.push({ file: rel, error: formatResult.error });
            } else if (formatResult.changed) {
                result.changed++;
                result.changedFiles.push(rel);
            } else if (formatResult.skipReason === 'no-imports') {
                result.noImports++;
            } else {
                result.unchanged++;
            }

            if ((i + 1) % 300 === 0 || i === files.length - 1) {
                console.log(`  [${label}] ${i + 1}/${files.length} — ${result.changed} changed so far`);
            }
        }
    } finally {
        for (const parser of parserCache.values()) {
            parser.dispose();
        }
    }

    return result;
}

function runYarnType(): { success: boolean; output: string } {
    try {
        const output = execSync('yarn type 2>&1', {
            cwd: PAYE_DIR,
            encoding: 'utf8',
            timeout: 120_000,
        });
        return { success: true, output };
    } catch (err: any) {
        return { success: false, output: err.stdout || err.message };
    }
}

function snapshotFiles(files: string[]): Map<string, string> {
    const snapshot = new Map<string, string>();
    for (const f of files) {
        snapshot.set(f, fs.readFileSync(f, 'utf8'));
    }
    return snapshot;
}

function diffSnapshot(before: Map<string, string>, after: string[]): string[] {
    const diffs: string[] = [];
    for (const f of after) {
        const current = fs.readFileSync(f, 'utf8');
        const original = before.get(f);
        if (original !== current) {
            diffs.push(path.relative(PAYE_DIR, f));
        }
    }
    return diffs;
}

function printResult(label: string, result: ConversionResult): void {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${label}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`  Total:     ${result.total}`);
    console.log(`  Changed:   ${result.changed}`);
    console.log(`  Unchanged: ${result.unchanged}`);
    console.log(`  No-imports: ${result.noImports}`);
    console.log(`  Errors:    ${result.errors}`);

    if (result.changedFiles.length > 0 && result.changedFiles.length <= 30) {
        console.log(`\n  Changed files:`);
        for (const f of result.changedFiles) {
            console.log(`    ${f}`);
        }
    } else if (result.changedFiles.length > 30) {
        console.log(`\n  Changed files (first 30 of ${result.changedFiles.length}):`);
        for (const f of result.changedFiles.slice(0, 30)) {
            console.log(`    ${f}`);
        }
    }

    if (result.errorFiles.length > 0) {
        console.log(`\n  Errors:`);
        for (const e of result.errorFiles.slice(0, 10)) {
            console.log(`    ${e.file}: ${e.error}`);
        }
    }
}

// --- Test ---

describe('Path resolution round-trip (paye)', () => {
    test('relative → absolute → yarn type → relative → yarn type → identity', async () => {
        if (!fs.existsSync(PAYE_DIR)) {
            console.log(`SKIPPED: ${PAYE_DIR} not found`);
            return;
        }

        console.log('\n📁 Discovering files...');
        const files = await discoverFiles(PAYE_DIR);
        console.log(`   Found ${files.length} files\n`);

        // --- Snapshot original state ---
        console.log('📸 Snapshotting original file contents...');
        const originalSnapshot = snapshotFiles(files);

        // --- STEP 1: Convert to ABSOLUTE ---
        console.log('\n🔄 STEP 1: Converting to ABSOLUTE mode...');
        const absoluteConfig = makeConfig('absolute');
        const absoluteResult = await runBatchFormat(files, absoluteConfig, WORKSPACE_ROOT, 'absolute');
        printResult('STEP 1: relative → absolute', absoluteResult);

        // Show sample diffs
        if (absoluteResult.changedFiles.length > 0) {
            console.log('\n  📋 Sample changes (first 5):');
            for (const rel of absoluteResult.changedFiles.slice(0, 5)) {
                const fullPath = path.join(PAYE_DIR, rel);
                const original = originalSnapshot.get(fullPath) || '';
                const current = fs.readFileSync(fullPath, 'utf8');

                // Extract import lines diff
                const origImports = original.split('\n').filter(l => l.startsWith('import '));
                const currImports = current.split('\n').filter(l => l.startsWith('import '));
                const changed = currImports.filter(l => !origImports.includes(l));
                if (changed.length > 0) {
                    console.log(`    ${rel}:`);
                    changed.slice(0, 3).forEach(l => console.log(`      + ${l.trim()}`));
                }
            }
        }

        // --- STEP 2: Yarn type after absolute ---
        console.log('\n🔍 STEP 2: Running yarn type (absolute mode)...');
        const typeAbsolute = runYarnType();
        console.log(`   Result: ${typeAbsolute.success ? '✅ PASS' : '❌ FAIL'}`);
        if (!typeAbsolute.success) {
            // Show first 30 lines of errors
            const errorLines = typeAbsolute.output.split('\n').slice(0, 30);
            console.log('   Errors:');
            errorLines.forEach(l => console.log(`     ${l}`));
        }

        // --- STEP 3: Convert back to RELATIVE ---
        console.log('\n🔄 STEP 3: Converting back to RELATIVE mode...');
        const relativeConfig = makeConfig('relative');
        const relativeResult = await runBatchFormat(files, relativeConfig, WORKSPACE_ROOT, 'relative');
        printResult('STEP 3: absolute → relative', relativeResult);

        // --- STEP 4: Yarn type after relative ---
        console.log('\n🔍 STEP 4: Running yarn type (relative mode)...');
        const typeRelative = runYarnType();
        console.log(`   Result: ${typeRelative.success ? '✅ PASS' : '❌ FAIL'}`);
        if (!typeRelative.success) {
            const errorLines = typeRelative.output.split('\n').slice(0, 30);
            console.log('   Errors:');
            errorLines.forEach(l => console.log(`     ${l}`));
        }

        // --- STEP 5: Verify round-trip identity ---
        console.log('\n🔍 STEP 5: Checking round-trip identity...');
        const diffs = diffSnapshot(originalSnapshot, files);
        if (diffs.length === 0) {
            console.log('   ✅ Perfect round-trip: all files identical to original');
        } else {
            console.log(`   ⚠️  ${diffs.length} files differ from original:`);
            for (const d of diffs.slice(0, 20)) {
                console.log(`     ${d}`);
            }
            if (diffs.length > 20) {
                console.log(`     ... and ${diffs.length - 20} more`);
            }
        }

        // --- FINAL SUMMARY ---
        console.log(`\n${'='.repeat(60)}`);
        console.log('FINAL SUMMARY');
        console.log(`${'='.repeat(60)}`);
        console.log(`  Files scanned:          ${files.length}`);
        console.log(`  Converted to absolute:  ${absoluteResult.changed}`);
        console.log(`  Converted to relative:  ${relativeResult.changed}`);
        console.log(`  Yarn type (absolute):   ${typeAbsolute.success ? 'PASS' : 'FAIL'}`);
        console.log(`  Yarn type (relative):   ${typeRelative.success ? 'PASS' : 'FAIL'}`);
        console.log(`  Round-trip diffs:       ${diffs.length}`);
        console.log(`  Errors (absolute):      ${absoluteResult.errors}`);
        console.log(`  Errors (relative):      ${relativeResult.errors}`);

        // Restore original files if round-trip failed
        if (diffs.length > 0) {
            console.log('\n🔧 Restoring original files...');
            for (const f of files) {
                const original = originalSnapshot.get(f);
                if (original !== undefined) {
                    fs.writeFileSync(f, original, 'utf8');
                }
            }
            console.log('   ✅ All files restored');
        }

        // Assertions
        expect(absoluteResult.errors).toBe(0);
        expect(relativeResult.errors).toBe(0);
        expect(typeAbsolute.success).toBe(true);
        expect(typeRelative.success).toBe(true);
    }, 600_000);
});
