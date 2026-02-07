import { parse } from '@typescript-eslint/parser';
import type { TSESTree } from '@typescript-eslint/types';

import { ImportType } from './parser';
import { GroupMatcher } from './utils/group-matcher';
import { buildDocument } from './ir/builders';
import { printDocument } from './ir/printer';

import type { ParsedImport, ImportSource } from './parser';
import type { Config } from './types';

interface ReExportBlock {
    range: [number, number];
    nodes: TSESTree.ExportNamedDeclaration[];
}

/**
 * Organize re-export statements (`export { ... } from '...'`) using the same
 * grouping, sorting and alignment rules as imports.
 *
 * Only runs when `config.format.organizeReExports` is true.
 * Returns the original text unchanged on parse errors or when no re-exports are found.
 */
export function organizeReExports(sourceText: string, config: Config): string {
    let ast: TSESTree.Program;
    try {
        ast = parse(sourceText, {
            ecmaVersion: 'latest',
            sourceType: 'module',
            jsx: true,
            errorOnUnknownASTType: false,
            errorOnTypeScriptSyntacticAndSemanticIssues: false,
            loc: true,
            range: true,
        });
    } catch {
        return sourceText;
    }

    const blocks = findReExportBlocks(ast, sourceText);
    if (blocks.length === 0) {
        return sourceText;
    }

    const groupMatcher = new GroupMatcher(config.groups);

    // Apply replacements bottom-up to preserve character offsets
    let result = sourceText;
    for (let i = blocks.length - 1; i >= 0; i--) {
        const block = blocks[i];
        const formatted = formatReExportBlock(block, groupMatcher, config);
        if (formatted !== null) {
            result = result.slice(0, block.range[0]) + formatted + result.slice(block.range[1]);
        }
    }

    return result;
}

/**
 * Find contiguous blocks of re-export statements in the AST.
 * A block is broken by any non-re-export statement.
 */
function findReExportBlocks(ast: TSESTree.Program, sourceText: string): ReExportBlock[] {
    const blocks: ReExportBlock[] = [];
    let currentNodes: TSESTree.ExportNamedDeclaration[] = [];

    for (const node of ast.body) {
        if (isReExportNode(node)) {
            currentNodes.push(node as TSESTree.ExportNamedDeclaration);
        } else {
            if (currentNodes.length > 1) {
                blocks.push(buildBlock(currentNodes, sourceText));
            }
            currentNodes = [];
        }
    }

    // Flush last block
    if (currentNodes.length > 1) {
        blocks.push(buildBlock(currentNodes, sourceText));
    }

    return blocks;
}

function isReExportNode(node: TSESTree.ProgramStatement): boolean {
    return (
        node.type === 'ExportNamedDeclaration' &&
        (node as TSESTree.ExportNamedDeclaration).source !== null &&
        (node as TSESTree.ExportNamedDeclaration).specifiers.length > 0
    );
}

function buildBlock(nodes: TSESTree.ExportNamedDeclaration[], sourceText: string): ReExportBlock {
    const first = nodes[0];
    const last = nodes[nodes.length - 1];

    // Expand start to beginning of line (to capture leading whitespace)
    let start = first.range![0];
    while (start > 0 && sourceText[start - 1] !== '\n') {
        start--;
    }

    // Expand end to end of line (to capture trailing newline)
    let end = last.range![1];
    while (end < sourceText.length && sourceText[end] !== '\n') {
        end++;
    }
    if (end < sourceText.length && sourceText[end] === '\n') {
        end++;
    }

    return { range: [start, end], nodes };
}

/**
 * Format a single contiguous block of re-exports through the IR pipeline.
 */
function formatReExportBlock(
    block: ReExportBlock,
    groupMatcher: GroupMatcher,
    config: Config
): string | null {
    const parsed = extractReExports(block.nodes, groupMatcher);
    if (parsed.length === 0) {
        return null;
    }

    const grouped = groupReExports(parsed, config);
    if (grouped.length === 0) {
        return null;
    }

    const irDocument = buildDocument(grouped, config);
    return printDocument(irDocument);
}

/**
 * Convert AST ExportNamedDeclaration nodes into ParsedImport structures.
 */
function extractReExports(
    nodes: TSESTree.ExportNamedDeclaration[],
    groupMatcher: GroupMatcher
): ParsedImport[] {
    const result: ParsedImport[] = [];

    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const source = node.source!.value as string;
        const isTypeExport = node.exportKind === 'type';

        const specifiers = node.specifiers
            .filter((s): s is TSESTree.ExportSpecifier => s.type === 'ExportSpecifier')
            .map((s) => {
                const exported = s.exported.type === 'Identifier' ? s.exported.name : s.exported.value;
                const local = s.local.type === 'Identifier' ? s.local.name : s.local.value;
                if (exported !== local) {
                    return { imported: local, local: exported } as const;
                }
                return exported;
            });

        if (specifiers.length === 0) {
            continue;
        }

        const groupName = groupMatcher.getGroup(source);

        // Determine type: if the export itself is `export type { ... }` use TYPE_NAMED,
        // otherwise use NAMED
        const type = isTypeExport ? ImportType.TYPE_NAMED : ImportType.NAMED;

        result.push({
            type,
            source: source as ImportSource,
            specifiers,
            raw: '',
            groupName,
            isPriority: false,
            sourceIndex: i,
            isReExport: true,
        });
    }

    return result;
}

/**
 * Group and sort re-exports using the same config groups as imports.
 */
function groupReExports(
    reExports: ParsedImport[],
    config: Config
): { name: string; imports: ParsedImport[] }[] {
    const groupMap = new Map<string, { order: number; imports: ParsedImport[] }>();

    // Initialize groups from config
    for (const g of config.groups) {
        groupMap.set(g.name, { order: g.order, imports: [] });
    }

    // Fallback group
    const defaultGroupName = config.groups.find((g) => g.default)?.name ?? 'Other';
    if (!groupMap.has(defaultGroupName)) {
        groupMap.set(defaultGroupName, { order: 999, imports: [] });
    }

    // Assign re-exports to groups
    for (const re of reExports) {
        const target = groupMap.get(re.groupName ?? '') ?? groupMap.get(defaultGroupName)!;
        target.imports.push(re);
    }

    // Sort within groups: named before type_named, then alphabetical
    for (const group of groupMap.values()) {
        group.imports.sort((a, b) => {
            const typeA = a.type === ImportType.TYPE_NAMED ? 1 : 0;
            const typeB = b.type === ImportType.TYPE_NAMED ? 1 : 0;
            if (typeA !== typeB) {
                return typeA - typeB;
            }
            return a.source.localeCompare(b.source);
        });
    }

    // Return non-empty groups sorted by order
    return Array.from(groupMap.entries())
        .filter(([, g]) => g.imports.length > 0)
        .sort(([, a], [, b]) => a.order - b.order)
        .map(([name, g]) => ({ name, imports: g.imports }));
}
