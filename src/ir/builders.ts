import { ImportType } from '../parser';

import type { ParsedImport } from '../parser';
import type { Config } from '../types';
import type {
    IRNode,
    IRAlignAnchor,
    IRAlignGroup,
    IRDocument,
    IRText,
    IRHardLine,
    IRConcat,
    IRIndent,
} from './types';

// ── Primitive constructors ──────────────────────────────────────────

export function text(value: string): IRText {
    return { kind: 'text', value };
}

export function hardLine(): IRHardLine {
    return { kind: 'hardLine' };
}

export function indent(count: number, content: IRNode): IRIndent {
    return { kind: 'indent', count, content };
}

export function concat(...parts: IRNode[]): IRConcat {
    return { kind: 'concat', parts };
}

export function alignAnchor(groupId: string, prefix: IRNode, suffix: IRNode, idealWidth?: number): IRAlignAnchor {
    return { kind: 'alignAnchor', groupId, prefix, suffix, idealWidth };
}

export function alignGroup(groupId: string, children: IRNode[]): IRAlignGroup {
    return { kind: 'alignGroup', groupId, children };
}

export function doc(children: IRNode[]): IRDocument {
    return { kind: 'document', children };
}

// ── Import node builders ────────────────────────────────────────────

function specToString(spec: string | { imported: string; local: string }): string {
    return typeof spec === 'string' ? spec : `${spec.imported} as ${spec.local}`;
}

function sortSpecs(specifiers: string[], config: Config): string[] {
    const mode = config.format?.sortSpecifiers ?? 'length';
    if (mode === 'length') {
        return [...specifiers].sort((a, b) => a.length - b.length);
    }
    if (mode === 'alpha') {
        return [...specifiers].sort((a, b) =>
            a.toLowerCase().localeCompare(b.toLowerCase(), 'en')
        );
    }
    return specifiers; // false — preserve order
}

/**
 * Build an IR node for a single ParsedImport.
 * Replicates the logic of the old `formatImportLine()` but produces IR.
 *
 * For imports that have a `from` keyword, the node is an `IRAlignAnchor`
 * so the printer can align `from` columns across the group.
 */
export function buildImportNode(imp: ParsedImport, config: Config, groupId: string): IRNode {
    const { type, source, specifiers } = imp;

    const keyword = imp.isReExport ? 'export' : 'import';
    const quote = config.format?.singleQuote !== false ? "'" : '"';
    const bracketSpace = config.format?.bracketSpacing !== false ? ' ' : '';
    const indentSize = config.format?.indent ?? 4;
    const indentStr = ' '.repeat(indentSize);

    // Side-effect imports: no `from`, no alignment
    if (type === ImportType.SIDE_EFFECT || specifiers.length === 0) {
        return text(`import ${quote}${source}${quote};`);
    }

    // Default import (single specifier)
    if (type === ImportType.DEFAULT && specifiers.length === 1) {
        const specStr = specToString(specifiers[0]);
        const prefix = `${keyword} ${specStr} `;
        const suffix = `from ${quote}${source}${quote};`;
        return alignAnchor(groupId, text(prefix), text(suffix));
    }

    // Type default import (single specifier)
    if (type === ImportType.TYPE_DEFAULT && specifiers.length === 1) {
        const specStr = specToString(specifiers[0]);
        const prefix = `${keyword} type ${specStr} `;
        const suffix = `from ${quote}${source}${quote};`;
        return alignAnchor(groupId, text(prefix), text(suffix));
    }

    // Named / typeNamed — unified single-line vs multiline decision
    if (type === ImportType.NAMED || type === ImportType.TYPE_NAMED) {
        const typePrefix = type === ImportType.TYPE_NAMED ? 'type ' : '';
        const trailingComma = config.format?.trailingComma ?? 'never';
        const maxLineWidth = config.format?.maxLineWidth;

        const formattedSpecs = specifiers.map(specToString);
        const uniqueSpecs = Array.from(new Set(formattedSpecs));
        const sorted = sortSpecs(uniqueSpecs, config);

        // Compute single-line representation
        const specStr = sorted.join(', ');
        const singlePrefix = `${keyword} ${typePrefix}{${bracketSpace}${specStr}${bracketSpace}} `;
        const singleSuffix = `from ${quote}${source}${quote};`;
        const singleWidth = singlePrefix.length + singleSuffix.length;

        // Decide: single-line or multiline?
        const useMultiline = maxLineWidth && maxLineWidth > 0
            ? singleWidth > maxLineWidth
            : sorted.length > 1;

        if (!useMultiline) {
            return alignAnchor(groupId, text(singlePrefix), text(singleSuffix));
        }

        // Multiline
        const firstLine = `${keyword} ${typePrefix}{`;

        const middleLines = sorted.map((spec, i) => {
            const isLast = i === sorted.length - 1;
            const comma = isLast ? (trailingComma === 'always' ? ',' : '') : ',';
            return `${indentStr}${spec}${comma}`;
        });

        // Compute idealWidth for alignment
        const middleLengths = sorted.map((spec) => spec.length);
        const maxSpecLength = Math.max(...middleLengths);

        const maxIndex = middleLengths.indexOf(maxSpecLength);
        const isLastSpec = maxIndex === sorted.length - 1;
        const adjustment = (trailingComma === 'always' || !isLastSpec) ? 2 : 1;
        const idealWidth = indentSize + maxSpecLength + adjustment;

        const prefixLines = [firstLine, ...middleLines, '} '];
        const prefixText = prefixLines.join('\n');

        const suffix = `from ${quote}${source}${quote};`;
        return alignAnchor(groupId, text(prefixText), text(suffix), idealWidth);
    }

    // Fallback: shouldn't normally reach here
    const formattedSpecs = specifiers.map(specToString);
    const specifiersStr = formattedSpecs.join(', ');
    const prefix = `${keyword} ${specifiersStr} `;
    const suffix = `from ${quote}${source}${quote};`;
    return alignAnchor(groupId, text(prefix), text(suffix));
}

/**
 * Build an IR align group for a named import group.
 * Produces: comment line + import nodes sharing the same groupId.
 */
export function buildGroupNode(groupName: string, imports: ParsedImport[], config: Config): IRAlignGroup {
    const groupId = groupName;
    const children: IRNode[] = [];

    // Comment line
    children.push(text(`// ${groupName}`));

    // Import nodes
    for (const imp of imports) {
        children.push(hardLine());
        children.push(buildImportNode(imp, config, groupId));
    }

    return alignGroup(groupId, children);
}

/**
 * Build the full IR document from sorted groups.
 * Inserts blank lines between groups and a trailing newline.
 */
export function buildDocument(
    groups: { name: string; imports: ParsedImport[] }[],
    config: Config
): IRDocument {
    const children: IRNode[] = [];

    for (let i = 0; i < groups.length; i++) {
        if (i > 0) {
            const blankLines = Math.max(0, config.format?.blankLinesBetweenGroups ?? 1);
            // 1 hardLine terminates the previous line, then N more for N blank lines
            for (let j = 0; j < 1 + blankLines; j++) {
                children.push(hardLine());
            }
        }
        children.push(buildGroupNode(groups[i].name, groups[i].imports, config));
    }

    // Trailing newline
    children.push(hardLine());

    return doc(children);
}
