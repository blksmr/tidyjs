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

export interface CheckOptions {
    configPath?: string;
    rootDir?: string;
}

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

export async function checkFile(filePath: string, config: Config): Promise<FileResult> {
    const absolutePath = path.resolve(filePath);
    const content = fs.readFileSync(absolutePath, 'utf8');
    const issues: string[] = [];

    if (hasIgnorePragma(content)) {
        return { filePath, issues: [], passed: true };
    }

    // Check imports
    const fileName = path.basename(filePath);
    const parserResult = parseImports(content, config, fileName);

    if (parserResult && parserResult.groups.length > 0) {
        const { text: formatted } = await formatImports(content, config, parserResult);
        if (formatted !== content) {
            issues.push('imports not sorted');
        }
    }

    // Check code patterns
    const codeFormatted = sortCodePatterns(content, config);
    if (codeFormatted !== content) {
        issues.push('code patterns unsorted');
    }

    return { filePath, issues, passed: issues.length === 0 };
}

export async function checkFiles(filePaths: string[], options: CheckOptions): Promise<FileResult[]> {
    const results: FileResult[] = [];
    for (const filePath of filePaths) {
        const config = loadConfigForFile(filePath, options);
        results.push(await checkFile(filePath, config));
    }
    return results;
}
