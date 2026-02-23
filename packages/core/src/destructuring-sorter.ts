import { parseSource } from './utils/oxc-parse';
import type * as AST from './types/ast';
import type { Config } from './types';

interface PropertyInfo {
    name: string;
    range: [number, number];
    isRest: boolean;
    text: string;
}

interface SortablePattern {
    kind: 'objectPattern' | 'objectExpression' | 'interfaceBody' | 'typeLiteral' | 'enumBody' | 'exportBlock' | 'classBody' | 'jsxAttributes';
    range: [number, number];
    properties: PropertyInfo[];
}

interface Replacement {
    range: [number, number];
    newText: string;
}

function getPropertyName(node: AST.ASTNode): string | null {
    switch (node.type) {
        case 'Property': {
            const prop = node as AST.Property;
            if (prop.computed) {return null;}
            if (prop.key.type === 'Identifier') {return prop.key.name ?? null;}
            if (prop.key.type === 'Literal') {return String(prop.key.value);}
            return null;
        }
        case 'RestElement':
            return null;
        case 'TSPropertySignature': {
            const sig = node as AST.TSPropertySignature;
            if (sig.computed) {return null;}
            if (sig.key.type === 'Identifier') {return sig.key.name ?? null;}
            if (sig.key.type === 'Literal') {return String(sig.key.value);}
            return null;
        }
        case 'TSMethodSignature': {
            const method = node as AST.TSMethodSignature;
            if (method.computed) {return null;}
            if (method.key.type === 'Identifier') {return method.key.name ?? null;}
            return null;
        }
        case 'TSEnumMember': {
            const member = node as AST.TSEnumMember;
            if (member.id.type === 'Identifier') {return member.id.name ?? null;}
            if (member.id.type === 'Literal') {return String(member.id.value);}
            return null;
        }
        case 'ExportSpecifier': {
            const spec = node as AST.ExportSpecifier;
            if (spec.exported.type === 'Identifier') {return spec.exported.name ?? null;}
            if (spec.exported.type === 'Literal') {return String(spec.exported.value);}
            return null;
        }
        case 'PropertyDefinition': {
            const propDef = node as AST.PropertyDefinition;
            if (propDef.computed) {return null;}
            if (propDef.key.type === 'Identifier') {return propDef.key.name ?? null;}
            if (propDef.key.type === 'Literal') {return String(propDef.key.value);}
            return null;
        }
        case 'JSXAttribute': {
            const attr = node as AST.JSXAttribute;
            return attr.name?.name ?? null;
        }
        case 'TSIndexSignature':
            return null;
        default:
            return null;
    }
}

function isRestNode(node: AST.ASTNode): boolean {
    return node.type === 'RestElement' || node.type === 'SpreadElement' || node.type === 'JSXSpreadAttribute';
}

function isMultiline(sourceText: string, range: [number, number]): boolean {
    const text = sourceText.slice(range[0], range[1]);
    return text.includes('\n');
}

function hasInternalComments(sourceText: string, range: [number, number]): boolean {
    const text = sourceText.slice(range[0], range[1]);
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        // Skip string literals (single, double, template)
        if (ch === '\'' || ch === '"' || ch === '`') {
            i++;
            while (i < text.length && text[i] !== ch) {
                if (text[i] === '\\') {i++;} // skip escaped char
                i++;
            }
            i++; // skip closing quote
            continue;
        }
        if (ch === '/' && i + 1 < text.length) {
            if (text[i + 1] === '/' || text[i + 1] === '*') {return true;}
        }
        i++;
    }
    return false;
}

function extractProperties(
    nodes: AST.ASTNode[],
    sourceText: string
): PropertyInfo[] | null {
    const properties: PropertyInfo[] = [];
    for (const node of nodes) {
        const range = node.range as [number, number];
        if (!range) {return null;}

        const name = getPropertyName(node);
        const rest = isRestNode(node);

        // Unknown node type — bail out entirely to avoid dropping it
        if (name === null && !rest) {return null;}

        properties.push({
            name: name ?? '',
            range,
            isRest: rest,
            text: sourceText.slice(range[0], range[1]),
        });
    }
    return properties;
}

function findBraceRange(
    nodeRange: [number, number],
    sourceText: string
): [number, number] | null {
    const nodeText = sourceText.slice(nodeRange[0], nodeRange[1]);
    const braceStart = nodeText.indexOf('{');
    const braceEnd = nodeText.lastIndexOf('}');
    if (braceStart === -1 || braceEnd === -1 || braceStart >= braceEnd) {return null;}
    return [nodeRange[0] + braceStart, nodeRange[0] + braceEnd + 1];
}

function rangesOverlap(a: [number, number], b: [number, number]): boolean {
    return a[0] < b[1] && b[0] < a[1];
}

/**
 * Find sortable patterns for the automatic pipeline (enum, export, class).
 * ObjectPattern, TSInterfaceBody, TSTypeLiteral are no longer sorted automatically.
 */
function findSortablePatterns(
    ast: AST.Program,
    sourceText: string,
    config?: Config
): SortablePattern[] {
    const patterns: SortablePattern[] = [];

    function walk(node: AST.ASTNode): void {
        if (!node || typeof node !== 'object') {return;}

        if (config?.format?.sortEnumMembers && node.type === 'TSEnumDeclaration' && node.range) {
            const enumNode = node as AST.TSEnumDeclaration;
            const members = enumNode.body?.members ?? enumNode.members;
            if (members && members.length >= 2) {
                const braceRange = findBraceRange(node.range as [number, number], sourceText);
                if (braceRange && isMultiline(sourceText, braceRange) && !hasInternalComments(sourceText, braceRange)) {
                    const props = extractProperties(
                        members as AST.ASTNode[],
                        sourceText
                    );
                    if (props && props.length >= 2) {
                        patterns.push({ kind: 'enumBody', range: braceRange, properties: props });
                    }
                }
            }
        }

        if (config?.format?.sortExports && node.type === 'ExportNamedDeclaration' && node.range) {
            const exportNode = node as AST.ExportNamedDeclaration;
            if (exportNode.specifiers.length >= 2) {
                const braceRange = findBraceRange(node.range as [number, number], sourceText);
                if (braceRange && isMultiline(sourceText, braceRange) && !hasInternalComments(sourceText, braceRange)) {
                    const props = extractProperties(
                        exportNode.specifiers as AST.ASTNode[],
                        sourceText
                    );
                    if (props && props.length >= 2) {
                        patterns.push({ kind: 'exportBlock', range: braceRange, properties: props });
                    }
                }
            }
        }

        if (config?.format?.sortClassProperties && node.type === 'ClassBody' && node.range) {
            const classBody = node as AST.ClassBody;
            // Find contiguous runs of PropertyDefinition nodes
            let currentRun: AST.PropertyDefinition[] = [];

            const flushRun = (): void => {
                if (currentRun.length >= 2) {
                    const first = currentRun[0];
                    const last = currentRun[currentRun.length - 1];

                    // Expand to line boundaries so indent detection works correctly
                    let runStart = first.range![0];
                    while (runStart > 0 && sourceText[runStart - 1] !== '\n') {
                        runStart--;
                    }
                    const runRange: [number, number] = [runStart, last.range![1]];

                    if (!hasInternalComments(sourceText, runRange)) {
                        const props = extractProperties(currentRun as AST.ASTNode[], sourceText);
                        if (props && props.length >= 2) {
                            patterns.push({ kind: 'classBody', range: runRange, properties: props });
                        }
                    }
                }
                currentRun = [];
            };

            for (const member of classBody.body) {
                if (member.type === 'PropertyDefinition' && !(member as AST.PropertyDefinition).static) {
                    currentRun.push(member as AST.PropertyDefinition);
                } else {
                    flushRun();
                }
            }
            flushRun();
        }

        if (config?.format?.sortTypeMembers && node.type === 'TSInterfaceBody' && node.range) {
            const range = node.range as [number, number];
            if (isMultiline(sourceText, range) && !hasInternalComments(sourceText, range)) {
                const props = extractProperties(
                    node.body as AST.ASTNode[],
                    sourceText
                );
                if (props && props.length >= 2) {
                    patterns.push({ kind: 'interfaceBody', range, properties: props });
                }
            }
        }

        if (config?.format?.sortTypeMembers && node.type === 'TSTypeLiteral' && node.range) {
            const range = node.range as [number, number];
            if (isMultiline(sourceText, range) && !hasInternalComments(sourceText, range)) {
                const props = extractProperties(
                    node.members as AST.ASTNode[],
                    sourceText
                );
                if (props && props.length >= 2) {
                    patterns.push({ kind: 'typeLiteral', range, properties: props });
                }
            }
        }

        for (const key of Object.keys(node)) {
            if (key === 'parent') {continue;}
            const value = (node as unknown as Record<string, unknown>)[key];
            if (Array.isArray(value)) {
                for (const item of value) {
                    if (item && typeof item === 'object' && 'type' in item) {
                        walk(item as AST.ASTNode);
                    }
                }
            } else if (value && typeof value === 'object' && 'type' in value) {
                walk(value as AST.ASTNode);
            }
        }
    }

    walk(ast);
    return patterns;
}

/**
 * Find sortable patterns within a selection range (for the manual command).
 * Collects ObjectPattern, ObjectExpression, TSInterfaceBody, TSTypeLiteral, JSXOpeningElement.
 * No config check — the user explicitly requested sorting.
 */
function findSortablePatternsInRange(
    ast: AST.Program,
    sourceText: string,
    selectionStart: number,
    selectionEnd: number
): SortablePattern[] {
    const patterns: SortablePattern[] = [];
    const selRange: [number, number] = [selectionStart, selectionEnd];

    function walk(node: AST.ASTNode): void {
        if (!node || typeof node !== 'object') {return;}

        if (node.type === 'ObjectPattern' && node.range) {
            const range = node.range as [number, number];
            if (rangesOverlap(range, selRange) && isMultiline(sourceText, range)) {
                const props = extractProperties(
                    node.properties as AST.ASTNode[],
                    sourceText
                );
                if (props && props.length >= 2) {
                    patterns.push({ kind: 'objectPattern', range, properties: props });
                }
            }
        }

        if (node.type === 'ObjectExpression' && node.range) {
            const range = node.range as [number, number];
            if (rangesOverlap(range, selRange) && isMultiline(sourceText, range)) {
                const props = extractProperties(
                    node.properties as AST.ASTNode[],
                    sourceText
                );
                if (props && props.length >= 2) {
                    patterns.push({ kind: 'objectExpression', range, properties: props });
                }
            }
        }

        if (node.type === 'TSInterfaceBody' && node.range) {
            const range = node.range as [number, number];
            if (rangesOverlap(range, selRange) && isMultiline(sourceText, range)) {
                const props = extractProperties(
                    node.body as AST.ASTNode[],
                    sourceText
                );
                if (props && props.length >= 2) {
                    patterns.push({ kind: 'interfaceBody', range, properties: props });
                }
            }
        }

        if (node.type === 'TSTypeLiteral' && node.range) {
            const range = node.range as [number, number];
            if (rangesOverlap(range, selRange) && isMultiline(sourceText, range)) {
                const props = extractProperties(
                    node.members as AST.ASTNode[],
                    sourceText
                );
                if (props && props.length >= 2) {
                    patterns.push({ kind: 'typeLiteral', range, properties: props });
                }
            }
        }

        if (node.type === 'JSXOpeningElement' && node.range) {
            const jsxEl = node as AST.JSXOpeningElement;
            const attrs = jsxEl.attributes;
            if (attrs && attrs.length >= 2) {
                const firstRange = attrs[0].range as [number, number] | undefined;
                const lastRange = attrs[attrs.length - 1].range as [number, number] | undefined;
                if (firstRange && lastRange) {
                    const range: [number, number] = [firstRange[0], lastRange[1]];
                    if (rangesOverlap(range, selRange) && isMultiline(sourceText, range)) {
                        const props = extractProperties(attrs, sourceText);
                        if (props && props.length >= 2) {
                            patterns.push({ kind: 'jsxAttributes', range, properties: props });
                        }
                    }
                }
            }
        }

        for (const key of Object.keys(node)) {
            if (key === 'parent') {continue;}
            const value = (node as unknown as Record<string, unknown>)[key];
            if (Array.isArray(value)) {
                for (const item of value) {
                    if (item && typeof item === 'object' && 'type' in item) {
                        walk(item as AST.ASTNode);
                    }
                }
            } else if (value && typeof value === 'object' && 'type' in value) {
                walk(value as AST.ASTNode);
            }
        }
    }

    walk(ast);
    return patterns;
}

function detectIndent(properties: PropertyInfo[], sourceText: string): string {
    // Detect indentation from actual property positions in the source.
    // Walk backward from each property's start to the previous newline.
    for (const prop of properties) {
        const propStart = prop.range[0];
        let lineStart = propStart;
        while (lineStart > 0 && sourceText[lineStart - 1] !== '\n') {
            lineStart--;
        }
        if (lineStart < propStart) {
            const leading = sourceText.slice(lineStart, propStart);
            if (/^\s+$/.test(leading)) {
                return leading;
            }
        }
    }
    return '    ';
}

function isShorthandJsxAttr(prop: PropertyInfo): boolean {
    // A boolean shorthand JSX attribute has no `=` in its text (e.g. `autoFocus`)
    return !prop.text.includes('=');
}

function isCommentLine(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
}

/**
 * Extract leading context (comments + blank lines) from the gap between two properties.
 * The gap starts after the previous property and ends at the start of the next property.
 * First line (newline after prev prop) and last line (indent for next prop) are structural — skipped.
 * Returns trimmed comment lines only (blank lines are discarded).
 * Only returns content if at least one comment line is present.
 */
function extractLeadingContext(gap: string): string[] {
    const lines = gap.split('\n');
    if (lines.length <= 2) {return [];}

    const contentLines = lines.slice(1, -1);
    const commentLines = contentLines.filter(l => isCommentLine(l)).map(l => l.trim());
    return commentLines;
}

/** Remove comment lines and associated blank lines from a text block. */
function stripCommentLines(text: string): string {
    const lines = text.split('\n');
    const filtered = lines.filter(line => !isCommentLine(line));
    return filtered.join('\n').replace(/\n(\s*\n)+/g, '\n');
}

function sortProperties(
    pattern: SortablePattern,
    sourceText: string,
    preserveComments = true,
    sortMode: 'length' | 'alpha' | false = 'length'
): Replacement | null {
    if (sortMode === false) {return null;}

    const { properties, range } = pattern;

    const restProps = properties.filter(p => p.isRest);
    const nonRestProps = properties.filter(p => !p.isRest);

    if (nonRestProps.length < 2) {return null;}

    const sortFn = sortMode === 'alpha'
        ? (a: PropertyInfo, b: PropertyInfo): number => a.name.toLowerCase().localeCompare(b.name.toLowerCase(), 'en')
        : (a: PropertyInfo, b: PropertyInfo): number => a.name.length - b.name.length || a.name.localeCompare(b.name);

    let sorted: PropertyInfo[];
    if (pattern.kind === 'jsxAttributes') {
        // Boolean shorthand attributes first, then the rest
        const booleans = nonRestProps.filter(p => isShorthandJsxAttr(p));
        const valued = nonRestProps.filter(p => !isShorthandJsxAttr(p));
        sorted = [...booleans.sort(sortFn), ...valued.sort(sortFn)];
    } else {
        sorted = [...nonRestProps].sort(sortFn);
    }

    const indent = detectIndent(properties, sourceText);

    // Compute leading context (comments + blank lines) for each property
    const leadingContext = new Map<PropertyInfo, string[]>();
    if (preserveComments) {
        leadingContext.set(properties[0], []);
        for (let i = 1; i < properties.length; i++) {
            const gap = sourceText.slice(properties[i - 1].range[1], properties[i].range[0]);
            leadingContext.set(properties[i], extractLeadingContext(gap));
        }
    }

    const getContext = (prop: PropertyInfo): string[] => leadingContext.get(prop) ?? [];

    // For interfaces/types/classes, the separator (;) is included in the AST range of each property.
    // For destructuring/objectExpression, commas are OUTSIDE the AST range — we must add them ourselves.
    const separatorIncluded = pattern.kind === 'interfaceBody' || pattern.kind === 'typeLiteral' || pattern.kind === 'classBody';

    const allSorted = [...sorted, ...restProps];

    // Helper: indent all lines except the first
    const indentLines = (rawLines: string[]): string[] =>
        rawLines.map((line, i) => i === 0 ? line : `${indent}${line}`);

    // Helper: return replacement only if the new text differs from the original
    const originalText = sourceText.slice(range[0], range[1]);
    const returnIfChanged = (newText: string): Replacement | null =>
        newText === originalText ? null : { range, newText };

    if (pattern.kind === 'classBody') {
        // No surrounding braces — range covers only the properties themselves
        const lines: string[] = [];
        for (const prop of allSorted) {
            for (const ctx of getContext(prop)) {
                lines.push(`${indent}${ctx}`);
            }
            lines.push(`${indent}${prop.text}`);
        }
        return returnIfChanged(lines.join('\n'));
    }

    if (pattern.kind === 'jsxAttributes') {
        // JSX attributes: no separators, range covers first..last attribute directly
        const lines: string[] = [];
        for (const prop of allSorted) {
            for (const ctx of getContext(prop)) {lines.push(ctx);}
            lines.push(prop.text);
        }
        return returnIfChanged(indentLines(lines).join('\n'));
    }

    // Use range-based prefix/suffix instead of line-based to avoid corruption
    // when properties share a line with opening/closing braces.
    const firstProp = properties[0];
    const lastProp = properties[properties.length - 1];
    let prefix = sourceText.slice(range[0], firstProp.range[0]);
    const suffix = sourceText.slice(lastProp.range[1], range[1]);

    // Handle comments in prefix (between opening brace and first property)
    const prefixContext = extractLeadingContext(prefix);
    if (prefixContext.length > 0) {
        if (preserveComments) {
            const existing = leadingContext.get(properties[0]) ?? [];
            leadingContext.set(properties[0], [...prefixContext, ...existing]);
        }
        prefix = stripCommentLines(prefix);
    }

    if (separatorIncluded) {
        const lines: string[] = [];
        for (const prop of allSorted) {
            for (const ctx of getContext(prop)) {lines.push(ctx);}
            lines.push(prop.text);
        }
        return returnIfChanged(prefix + indentLines(lines).join('\n') + suffix);
    }

    // Destructuring/ObjectExpression: detect trailing comma from text between last property and closing brace
    const hasTrailingComma = /^\s*,/.test(suffix);
    const cleanSuffix = suffix.replace(/^\s*,/, '');

    const lines: string[] = [];
    for (let i = 0; i < allSorted.length; i++) {
        const prop = allSorted[i];
        const isLast = i === allSorted.length - 1;
        const comma = isLast ? (hasTrailingComma ? ',' : '') : ',';
        for (const ctx of getContext(prop)) {lines.push(ctx);}
        lines.push(`${prop.text}${comma}`);
    }
    return returnIfChanged(prefix + indentLines(lines).join('\n') + cleanSuffix);
}

function applyReplacements(sourceText: string, replacements: Replacement[]): string {
    // Sort replacements by range start, descending (bottom-up)
    const sorted = [...replacements].sort((a, b) => b.range[0] - a.range[0]);
    let result = sourceText;
    for (const rep of sorted) {
        result = result.slice(0, rep.range[0]) + rep.newText + result.slice(rep.range[1]);
    }
    return result;
}

function filterNonOverlapping(replacements: Replacement[]): Replacement[] {
    // Sort by range start ascending, then by range length descending (outer first)
    const sorted = [...replacements].sort((a, b) =>
        a.range[0] - b.range[0] || (b.range[1] - b.range[0]) - (a.range[1] - a.range[0])
    );
    const result: Replacement[] = [];
    let lastEnd = -1;
    for (const rep of sorted) {
        if (rep.range[0] >= lastEnd) {
            result.push(rep);
            lastEnd = rep.range[1];
        }
        // else: nested within or overlapping — skip for this pass
    }
    return result;
}

/**
 * Automatic pipeline: sorts enum members, exports, class properties.
 * ObjectPattern, TSInterfaceBody, TSTypeLiteral are no longer sorted automatically —
 * use sortPropertiesInSelection() for those via the manual command.
 */
export function sortCodePatterns(sourceText: string, config?: Config): string {
    let current = sourceText;

    // Iterate to handle nested sortable patterns (outer sort invalidates inner ranges)
    for (let iteration = 0; iteration < 10; iteration++) {
        let ast: AST.Program;
        try {
            ast = parseSource(current, { jsx: true });
        } catch {
            return current;
        }

        const patterns = findSortablePatterns(ast, current, config);
        const replacements: Replacement[] = [];

        const sortMode = config?.format?.sortSpecifiers ?? 'length';
        for (const pattern of patterns) {
            const replacement = sortProperties(pattern, current, true, sortMode);
            if (replacement) {
                replacements.push(replacement);
            }
        }

        if (replacements.length === 0) {return current;}

        const safe = filterNonOverlapping(replacements);
        current = applyReplacements(current, safe);

        // No overlaps were filtered out — all replacements applied in one pass
        if (safe.length === replacements.length) {return current;}
    }

    return current;
}

/**
 * Manual command: sort properties in the user's selection.
 * Collects ObjectPattern, ObjectExpression, TSInterfaceBody, TSTypeLiteral, JSXOpeningElement
 * whose range overlaps the selection.
 * Returns null if nothing to sort.
 */
export function sortPropertiesInSelection(
    sourceText: string,
    selectionStart: number,
    selectionEnd: number,
    config?: Config
): string | null {
    const preserveComments = config?.format?.preserveComments !== false;
    const sortMode = config?.format?.sortSpecifiers ?? 'length';
    let current = sourceText;

    for (let iteration = 0; iteration < 10; iteration++) {
        let ast: AST.Program;
        try {
            ast = parseSource(current, { jsx: true });
        } catch {
            return iteration === 0 ? null : current;
        }

        const patterns = findSortablePatternsInRange(ast, current, selectionStart, selectionEnd);
        const replacements: Replacement[] = [];

        for (const pattern of patterns) {
            const replacement = sortProperties(pattern, current, preserveComments, sortMode);
            if (replacement) {
                replacements.push(replacement);
            }
        }

        if (replacements.length === 0) {
            return iteration === 0 ? null : current;
        }

        const safe = filterNonOverlapping(replacements);
        current = applyReplacements(current, safe);

        if (safe.length === replacements.length) {return current;}
    }

    return current;
}
