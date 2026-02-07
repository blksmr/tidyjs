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
    const indentSize = config.format?.indent || 4;
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

    // Named / typeNamed with single specifier (inline braces)
    if ((type === ImportType.NAMED || type === ImportType.TYPE_NAMED) && specifiers.length === 1) {
        const typePrefix = type === ImportType.TYPE_NAMED ? 'type ' : '';
        const specStr = specToString(specifiers[0]);
        const prefix = `${keyword} ${typePrefix}{${bracketSpace}${specStr}${bracketSpace}} `;
        const suffix = `from ${quote}${source}${quote};`;
        return alignAnchor(groupId, text(prefix), text(suffix));
    }

    // Named / typeNamed with multiple specifiers → multiline
    if ((type === ImportType.NAMED || type === ImportType.TYPE_NAMED) && specifiers.length > 1) {
        const typePrefix = type === ImportType.TYPE_NAMED ? 'type ' : '';

        const formattedSpecs = specifiers.map(specToString);
        const specifiersSet = new Set(formattedSpecs);
        const sortedSpecifiers = Array.from(specifiersSet).sort((a, b) => a.length - b.length);

        // Build the multiline import/export as IR
        const firstLine = `${keyword} ${typePrefix}{`;

        // Middle lines: `    specifier,`
        const middleLines = sortedSpecifiers.map((spec, i) => {
            const comma = i < sortedSpecifiers.length - 1 ? ',' : '';
            return `${indentStr}${spec}${comma}`;
        });

        // Compute idealWidth for alignment:
        const middleLengths = sortedSpecifiers.map((spec) => spec.length);
        const maxSpecLength = Math.max(...middleLengths);

        const maxIndex = middleLengths.indexOf(maxSpecLength);
        const isLastSpec = maxIndex === sortedSpecifiers.length - 1;
        const adjustment = !isLastSpec ? 2 : 1;
        const idealWidth = indentSize + maxSpecLength + adjustment;

        // Build the full multiline text for the prefix part
        const prefixLines = [firstLine, ...middleLines, '} '];
        const prefixText = prefixLines.join('\n');

        const suffix = `from ${quote}${source}${quote};`;
        return alignAnchor(groupId, text(prefixText), text(suffix), idealWidth);
    }

    // Fallback: generic named import/export (shouldn't normally reach here)
    const typePrefix = type === ImportType.TYPE_NAMED ? 'type ' : '';
    const formattedSpecs = specifiers.map(specToString);
    const specifiersStr = formattedSpecs.join(', ');
    const prefix = `${keyword} ${typePrefix}{${bracketSpace}${specifiersStr}${bracketSpace}} `;
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
            // Blank line between groups (two hardLines = \n\n)
            children.push(hardLine());
            children.push(hardLine());
        }
        children.push(buildGroupNode(groups[i].name, groups[i].imports, config));
    }

    // Trailing newline
    children.push(hardLine());

    return doc(children);
}
