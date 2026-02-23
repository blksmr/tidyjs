import * as fs from 'fs';
import * as path from 'path';
import {
    parseImports,
    formatImports,
    sortCodePatterns,
    loadConfig,
    loadConfigFile,
    convertFileConfig,
    resolveConfig,
    hasIgnorePragma,
} from '@tidyjs/core';
import type { Config } from '@tidyjs/core';
import type { FileResult } from '../reporter';
import type { CheckOptions } from './check';

function loadConfigForFile(filePath: string, options: CheckOptions): Config {
    if (options.configPath) {
        const fileConfig = loadConfigFile(options.configPath);
        if (fileConfig) {
            const partial = convertFileConfig(fileConfig, options.configPath);
            return resolveConfig(partial);
        }
    }

    return loadConfig({
        filePath: path.resolve(filePath),
        rootDir: options.rootDir,
    });
}

export async function fixFile(filePath: string, options: CheckOptions): Promise<FileResult> {
    const absolutePath = path.resolve(filePath);
    const content = fs.readFileSync(absolutePath, 'utf8');
    const issues: string[] = [];

    if (hasIgnorePragma(content)) {
        return { filePath, issues: [], passed: true };
    }

    const config = loadConfigForFile(filePath, options);
    let result = content;

    // Fix imports
    const fileName = path.basename(filePath);
    const parserResult = parseImports(result, config, fileName);

    if (parserResult && parserResult.groups.length > 0) {
        const { text: formatted } = await formatImports(result, config, parserResult);
        if (formatted !== result) {
            issues.push('imports fixed');
            result = formatted;
        }
    }

    // Fix code patterns
    const codeFormatted = sortCodePatterns(result, config);
    if (codeFormatted !== result) {
        issues.push('code patterns fixed');
        result = codeFormatted;
    }

    if (result !== content) {
        fs.writeFileSync(absolutePath, result, 'utf8');
    }

    return { filePath, issues, passed: issues.length === 0 };
}

export async function fixFiles(filePaths: string[], options: CheckOptions): Promise<FileResult[]> {
    const results: FileResult[] = [];
    for (const filePath of filePaths) {
        results.push(await fixFile(filePath, options));
    }
    return results;
}
