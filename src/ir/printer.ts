import type { IRNode, IRDocument } from './types';

// ── Pass 1: Measure ─────────────────────────────────────────────────

/**
 * Check whether an IR node will produce a line break when rendered.
 */
function containsNewline(node: IRNode): boolean {
    switch (node.kind) {
        case 'text':
            return node.value.includes('\n');
        case 'hardLine':
            return true;
        case 'indent':
            return containsNewline(node.content);
        case 'concat':
            return node.parts.some(containsNewline);
        case 'alignAnchor':
            return containsNewline(node.prefix) || containsNewline(node.suffix);
        case 'alignGroup':
            return node.children.some(containsNewline);
        case 'document':
            return node.children.some(containsNewline);
    }
}

/**
 * Measure the last-line width across an array of IR children.
 * Handles nested nodes that contain line breaks correctly.
 */
function measureChildren(children: IRNode[]): number {
    let width = 0;
    for (const child of children) {
        if (containsNewline(child)) {
            width = measureTextWidth(child);
        } else {
            width += measureTextWidth(child);
        }
    }
    return width;
}

/**
 * Measure the text width of an IR node.
 * For nodes containing hardLines, only the *last line* is measured
 * (because that line determines the `from` column position).
 */
export function measureTextWidth(node: IRNode): number {
    switch (node.kind) {
        case 'text': {
            const lines = node.value.split('\n');
            return lines[lines.length - 1].length;
        }
        case 'hardLine':
            return 0;
        case 'indent':
            return node.count + measureTextWidth(node.content);
        case 'concat':
            return measureChildren(node.parts);
        case 'alignAnchor':
            // Shouldn't be called directly in measurement, but handle gracefully
            return measureTextWidth(node.prefix) + measureTextWidth(node.suffix);
        case 'alignGroup':
            return measureChildren(node.children);
        case 'document':
            return measureChildren(node.children);
    }
}

/**
 * Collect all alignment anchors and compute the resolved column
 * for each groupId.
 *
 * For each anchor, the effective width is:
 *   - `idealWidth` if specified (multiline imports)
 *   - `measureTextWidth(prefix)` otherwise (single-line imports)
 *
 * The resolved column for a groupId = max of all effective widths in that group.
 */
export function measure(node: IRNode): Map<string, number> {
    const widthsByGroup = new Map<string, number[]>();

    function collect(n: IRNode): void {
        switch (n.kind) {
            case 'text':
            case 'hardLine':
                break;
            case 'indent':
                collect(n.content);
                break;
            case 'concat':
                for (const part of n.parts) {
                    collect(part);
                }
                break;
            case 'alignAnchor': {
                const effectiveWidth = n.idealWidth ?? measureTextWidth(n.prefix);
                const existing = widthsByGroup.get(n.groupId) || [];
                existing.push(effectiveWidth);
                widthsByGroup.set(n.groupId, existing);
                break;
            }
            case 'alignGroup':
                for (const child of n.children) {
                    collect(child);
                }
                break;
            case 'document':
                for (const child of n.children) {
                    collect(child);
                }
                break;
        }
    }

    collect(node);

    const resolved = new Map<string, number>();
    for (const [groupId, widths] of widthsByGroup) {
        resolved.set(groupId, Math.max(...widths));
    }

    return resolved;
}

// ── Pass 2: Render ──────────────────────────────────────────────────

/**
 * Render an IR node to a string, using the resolved alignment columns.
 */
export function render(node: IRNode, resolved: Map<string, number>): string {
    switch (node.kind) {
        case 'text':
            return node.value;
        case 'hardLine':
            return '\n';
        case 'indent':
            return ' '.repeat(node.count) + render(node.content, resolved);
        case 'concat':
            return node.parts.map((p) => render(p, resolved)).join('');
        case 'alignAnchor': {
            const prefixStr = render(node.prefix, resolved);
            const suffixStr = render(node.suffix, resolved);
            const targetColumn = resolved.get(node.groupId) ?? 0;

            // For multiline imports, we need to pad the last line of the prefix
            const prefixLines = prefixStr.split('\n');
            if (prefixLines.length > 1) {
                const lastLine = prefixLines[prefixLines.length - 1];
                // Find the closing brace position for proper padding
                const closeBraceIndex = lastLine.indexOf('}');
                if (closeBraceIndex !== -1) {
                    const beforeContent = lastLine.substring(0, closeBraceIndex + 1);
                    const targetLength = Math.max(beforeContent.length + 1, targetColumn);
                    prefixLines[prefixLines.length - 1] = beforeContent.padEnd(targetLength);
                } else {
                    // No closing brace — pad from start
                    const trimmed = lastLine.trimEnd();
                    const targetLength = Math.max(trimmed.length + 1, targetColumn);
                    prefixLines[prefixLines.length - 1] = trimmed.padEnd(targetLength);
                }
                return prefixLines.join('\n') + suffixStr;
            }

            // Single-line: pad prefix to target column
            const targetPadding = Math.max(targetColumn, prefixStr.length);
            return prefixStr.padEnd(targetPadding) + suffixStr;
        }
        case 'alignGroup':
            return node.children.map((c) => render(c, resolved)).join('');
        case 'document':
            return node.children.map((c) => render(c, resolved)).join('');
    }
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Print an IR document to a string.
 * Two-pass: measure alignment columns, then render with padding.
 */
export function printDocument(document: IRDocument): string {
    const resolved = measure(document);
    return render(document, resolved);
}
