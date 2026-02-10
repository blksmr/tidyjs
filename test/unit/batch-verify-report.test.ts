/**
 * E2E Batch Format Verification Report
 *
 * Runs the batch formatter in dry-run mode on a real codebase and outputs
 * detailed per-file categorization for validation.
 *
 * Usage:
 *   npx jest test/unit/batch-verify-report.test.ts --no-coverage --verbose --testTimeout=300000
 *
 * Environment variables:
 *   VERIFY_DIR      — root folder to scan (default: /Users/belkicasmir/Documents/GitHub/work/Yeap-UI-Apps/apps)
 *   WORKSPACE_ROOT  — workspace root for path resolution (default: parent of VERIFY_DIR)
 *   REPORT_FILE     — path to write the report (default: plans/batch-verify-report.txt)
 */
import * as fs from 'fs';
import * as path from 'path';

import { discoverFiles, isFileInExcludedFolder } from '../../src/batch-formatter';
import { ImportParser } from '../../src/parser';
import { formatImports } from '../../src/formatter';
import { sortCodePatterns } from '../../src/destructuring-sorter';
import { organizeReExports } from '../../src/reexport-organizer';
import { PathResolver } from '../../src/utils/path-resolver';
import { hasIgnorePragma } from '../../src/utils/ignore-pragma';

import type { Config } from '../../src/types';
import type { ParserResult, ParsedImport, ImportSource } from '../../src/parser';

// --- Configuration ---

const TARGET_DIR = process.env.VERIFY_DIR
    || '/Users/belkicasmir/Documents/GitHub/work/Yeap-UI-Apps/apps';

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT
    || path.dirname(TARGET_DIR);

const REPORT_FILE = process.env.REPORT_FILE
    || path.join(process.cwd(), 'plans', 'batch-verify-report.txt');

const CONFIG: Config = {
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
        mode: 'relative',
        enabled: true,
    },
    excludedFolders: [],
};

// --- Types ---

type Category = 'formatted' | 'empty' | 'ignored' | 'no-imports' | 'unchanged' | 'error';

interface FileReport {
    filePath: string;
    relativePath: string;
    category: Category;
    detail?: string;
}

// --- Dry-run classification ---

function applyPathResolutionBatch(
    originalResult: ParserResult,
    pathResolver: PathResolver,
    filePath: string,
    parserInstance: ImportParser,
    mode: 'absolute' | 'relative',
    workspaceRoot: string
): ParserResult | null {
    const allImports: ParsedImport[] = [];
    for (const group of originalResult.groups) {
        allImports.push(...group.imports);
    }

    const convertedImports: ParsedImport[] = [];
    let hasChanges = false;

    for (const importInfo of allImports) {
        const resolvedPath = pathResolver.convertImportPathBatch(
            importInfo.source, filePath, workspaceRoot
        );

        if (resolvedPath && resolvedPath !== importInfo.source) {
            let groupName = importInfo.groupName;
            let isPriority = importInfo.isPriority;

            if (mode === 'absolute') {
                const result = parserInstance.determineGroup(resolvedPath);
                groupName = result.groupName;
                isPriority = result.isPriority;
            }

            convertedImports.push({
                ...importInfo,
                source: resolvedPath as ImportSource,
                groupName,
                isPriority
            });
            hasChanges = true;
        } else {
            convertedImports.push(importInfo);
        }
    }

    if (!hasChanges) { return null; }

    return {
        ...originalResult,
        groups: parserInstance.organizeImportsIntoGroups(convertedImports)
    };
}

async function classifyFile(
    filePath: string,
    config: Config,
    parser: ImportParser,
    workspaceRoot: string
): Promise<{ category: Category; detail?: string }> {
    let sourceText: string;
    try {
        sourceText = await fs.promises.readFile(filePath, 'utf8');
    } catch (err) {
        return { category: 'error', detail: `read: ${err}` };
    }

    if (!sourceText.trim()) {
        return { category: 'empty' };
    }

    if (hasIgnorePragma(sourceText)) {
        return { category: 'ignored' };
    }

    // Check excluded
    if (isFileInExcludedFolder(filePath, config, workspaceRoot)) {
        return { category: 'ignored', detail: 'excluded folder' };
    }

    let parserResult: ParserResult;
    try {
        parserResult = parser.parse(sourceText, undefined, undefined, filePath);
    } catch (err) {
        return { category: 'error', detail: `parse: ${err}` };
    }

    if (parserResult.invalidImports && parserResult.invalidImports.length > 0) {
        return { category: 'error', detail: `invalid imports: ${parserResult.invalidImports[0].error}` };
    }

    // Apply path resolution (dry-run)
    if (config.pathResolution?.enabled && workspaceRoot) {
        try {
            const pathResolver = new PathResolver({
                mode: config.pathResolution.mode || 'relative',
                preferredAliases: config.pathResolution.preferredAliases || [],
                aliases: config.pathResolution.aliases,
            });
            const enhanced = applyPathResolutionBatch(
                parserResult, pathResolver, filePath, parser,
                config.pathResolution.mode || 'relative', workspaceRoot
            );
            if (enhanced) { parserResult = enhanced; }
        } catch {
            // Continue without path resolution
        }
    }

    const hasImports = parserResult.importRange && parserResult.groups.length > 0;
    if (!hasImports) {
        return { category: 'no-imports' };
    }

    // Format (without writing)
    let finalText: string;
    try {
        const formatted = await formatImports(sourceText, config, parserResult);
        if (formatted.error) {
            return { category: 'error', detail: `format: ${formatted.error}` };
        }
        finalText = formatted.text;
    } catch (err) {
        return { category: 'error', detail: `format exception: ${err}` };
    }

    // Post-processing
    if (config.format?.sortEnumMembers || config.format?.sortExports || config.format?.sortClassProperties) {
        finalText = sortCodePatterns(finalText, config);
    }
    if (config.format?.organizeReExports) {
        finalText = organizeReExports(finalText, config);
    }

    if (finalText === sourceText) {
        return { category: 'unchanged' };
    }

    return { category: 'formatted' };
}

// --- Report writer ---

function writeReport(reports: FileReport[], reportPath: string): void {
    const categories: Record<Category, FileReport[]> = {
        formatted: [],
        empty: [],
        ignored: [],
        'no-imports': [],
        unchanged: [],
        error: [],
    };

    for (const r of reports) {
        categories[r.category].push(r);
    }

    const lines: string[] = [];
    lines.push('='.repeat(80));
    lines.push('BATCH FORMAT VERIFICATION REPORT');
    lines.push(`Target: ${TARGET_DIR}`);
    lines.push(`Workspace root: ${WORKSPACE_ROOT}`);
    lines.push(`Total files: ${reports.length}`);
    lines.push(`Date: ${new Date().toISOString()}`);
    lines.push('='.repeat(80));
    lines.push('');

    // Summary
    lines.push('--- SUMMARY ---');
    for (const [cat, files] of Object.entries(categories)) {
        lines.push(`  ${cat.padEnd(15)} ${files.length}`);
    }
    lines.push('');

    // Detailed per-category
    for (const [cat, files] of Object.entries(categories)) {
        lines.push('-'.repeat(60));
        lines.push(`${cat.toUpperCase()} (${files.length})`);
        lines.push('-'.repeat(60));
        if (files.length === 0) {
            lines.push('  (none)');
        } else {
            for (const f of files) {
                const detail = f.detail ? ` — ${f.detail}` : '';
                lines.push(`  ${f.relativePath}${detail}`);
            }
        }
        lines.push('');
    }

    const content = lines.join('\n');

    // Write to file
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, content, 'utf8');

    // Also log to console
    console.log(content);
}

// --- Test ---

describe('Batch format verification report', () => {
    test('classifies all files and generates report', async () => {
        // Skip if target directory doesn't exist
        if (!fs.existsSync(TARGET_DIR)) {
            console.log(`SKIPPED: target directory not found: ${TARGET_DIR}`);
            return;
        }

        console.log(`\nDiscovering files in ${TARGET_DIR}...`);
        const files = await discoverFiles(TARGET_DIR);
        console.log(`Found ${files.length} files\n`);

        const parser = new ImportParser(CONFIG);
        const reports: FileReport[] = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const filePath = files[i];
                const relativePath = path.relative(TARGET_DIR, filePath);

                const { category, detail } = await classifyFile(
                    filePath, CONFIG, parser, WORKSPACE_ROOT
                );

                reports.push({ filePath, relativePath, category, detail });

                // Progress every 200 files
                if ((i + 1) % 200 === 0 || i === files.length - 1) {
                    console.log(`  Progress: ${i + 1}/${files.length}`);
                }
            }
        } finally {
            parser.dispose();
        }

        writeReport(reports, REPORT_FILE);

        // Basic sanity assertions
        expect(reports.length).toBe(files.length);
        expect(reports.filter(r => r.category === 'error').length).toBeLessThan(10);
    }, 300_000);
});
