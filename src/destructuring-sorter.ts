import { parse } from '@typescript-eslint/parser';
import type { TSESTree } from '@typescript-eslint/types';
import type { Config } from './types';

interface PropertyInfo {
    name: string;
    range: [number, number];
    isRest: boolean;
    text: string;
}

interface SortablePattern {
    kind: 'objectPattern' | 'interfaceBody' | 'typeLiteral' | 'enumBody' | 'exportBlock' | 'classBody';
    range: [number, number];
    properties: PropertyInfo[];
}

interface Replacement {
    range: [number, number];
    newText: string;
}

function getPropertyName(node: TSESTree.Node): string | null {
    switch (node.type) {
        case 'Property': {
            const prop = node as TSESTree.Property;
            if (prop.computed) {return null;}
            if (prop.key.type === 'Identifier') {return prop.key.name;}
            if (prop.key.type === 'Literal') {return String(prop.key.value);}
            return null;
        }
        case 'RestElement':
            return null;
        case 'TSPropertySignature': {
            const sig = node as TSESTree.TSPropertySignature;
            if (sig.computed) {return null;}
            if (sig.key.type === 'Identifier') {return sig.key.name;}
            if (sig.key.type === 'Literal') {return String(sig.key.value);}
            return null;
        }
        case 'TSMethodSignature': {
            const method = node as TSESTree.TSMethodSignature;
            if (method.computed) {return null;}
            if (method.key.type === 'Identifier') {return method.key.name;}
            return null;
        }
        case 'TSEnumMember': {
            const member = node as TSESTree.TSEnumMember;
            if (member.id.type === 'Identifier') {return member.id.name;}
            if (member.id.type === 'Literal') {return String(member.id.value);}
            return null;
        }
        case 'ExportSpecifier': {
            const spec = node as TSESTree.ExportSpecifier;
            if (spec.exported.type === 'Identifier') {return spec.exported.name;}
            return null;
        }
        case 'PropertyDefinition': {
            const propDef = node as TSESTree.PropertyDefinition;
            if (propDef.computed) {return null;}
            if (propDef.key.type === 'Identifier') {return propDef.key.name;}
            if (propDef.key.type === 'Literal') {return String(propDef.key.value);}
            return null;
        }
        case 'TSIndexSignature':
            return null;
        default:
            return null;
    }
}

function isRestNode(node: TSESTree.Node): boolean {
    return node.type === 'RestElement' || node.type === 'SpreadElement';
}

function isMultiline(sourceText: string, range: [number, number]): boolean {
    const text = sourceText.slice(range[0], range[1]);
    return text.includes('\n');
}

function hasInternalComments(sourceText: string, range: [number, number]): boolean {
    const text = sourceText.slice(range[0], range[1]);
    return text.includes('//') || text.includes('/*');
}

function extractProperties(
    nodes: TSESTree.Node[],
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

function findSortablePatterns(
    ast: TSESTree.Program,
    sourceText: string,
    config?: Config
): SortablePattern[] {
    const patterns: SortablePattern[] = [];

    function walk(node: TSESTree.Node): void {
        if (!node || typeof node !== 'object') {return;}

        if (config?.format?.sortDestructuring && node.type === 'ObjectPattern' && node.range) {
            const range = node.range as [number, number];
            if (isMultiline(sourceText, range) && !hasInternalComments(sourceText, range)) {
                const props = extractProperties(
                    node.properties as TSESTree.Node[],
                    sourceText
                );
                if (props && props.length >= 2) {
                    patterns.push({ kind: 'objectPattern', range, properties: props });
                }
            }
        }

        if (config?.format?.sortDestructuring && node.type === 'ObjectExpression' && node.range) {
            const range = node.range as [number, number];
            if (isMultiline(sourceText, range) && !hasInternalComments(sourceText, range)) {
                const props = extractProperties(
                    (node as TSESTree.ObjectExpression).properties as TSESTree.Node[],
                    sourceText
                );
                if (props && props.length >= 2) {
                    patterns.push({ kind: 'objectPattern', range, properties: props });
                }
            }
        }

        if (config?.format?.sortDestructuring && node.type === 'TSInterfaceBody' && node.range) {
            const range = node.range as [number, number];
            if (isMultiline(sourceText, range) && !hasInternalComments(sourceText, range)) {
                const props = extractProperties(
                    node.body as TSESTree.Node[],
                    sourceText
                );
                if (props && props.length >= 2) {
                    patterns.push({ kind: 'interfaceBody', range, properties: props });
                }
            }
        }

        if (config?.format?.sortDestructuring && node.type === 'TSTypeLiteral' && node.range) {
            const range = node.range as [number, number];
            if (isMultiline(sourceText, range) && !hasInternalComments(sourceText, range)) {
                const props = extractProperties(
                    node.members as TSESTree.Node[],
                    sourceText
                );
                if (props && props.length >= 2) {
                    patterns.push({ kind: 'typeLiteral', range, properties: props });
                }
            }
        }

        if (config?.format?.sortEnumMembers && node.type === 'TSEnumDeclaration' && node.range) {
            const enumNode = node as TSESTree.TSEnumDeclaration;
            const members = enumNode.body?.members ?? enumNode.members;
            if (members.length >= 2) {
                const braceRange = findBraceRange(node.range as [number, number], sourceText);
                if (braceRange && isMultiline(sourceText, braceRange) && !hasInternalComments(sourceText, braceRange)) {
                    const props = extractProperties(
                        members as TSESTree.Node[],
                        sourceText
                    );
                    if (props && props.length >= 2) {
                        patterns.push({ kind: 'enumBody', range: braceRange, properties: props });
                    }
                }
            }
        }

        if (config?.format?.sortExports && node.type === 'ExportNamedDeclaration' && node.range) {
            const exportNode = node as TSESTree.ExportNamedDeclaration;
            if (exportNode.specifiers.length >= 2) {
                const braceRange = findBraceRange(node.range as [number, number], sourceText);
                if (braceRange && isMultiline(sourceText, braceRange) && !hasInternalComments(sourceText, braceRange)) {
                    const props = extractProperties(
                        exportNode.specifiers as TSESTree.Node[],
                        sourceText
                    );
                    if (props && props.length >= 2) {
                        patterns.push({ kind: 'exportBlock', range: braceRange, properties: props });
                    }
                }
            }
        }

        if (config?.format?.sortClassProperties && node.type === 'ClassBody' && node.range) {
            const classBody = node as TSESTree.ClassBody;
            // Find contiguous runs of PropertyDefinition nodes
            let currentRun: TSESTree.PropertyDefinition[] = [];

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
                        const props = extractProperties(currentRun as TSESTree.Node[], sourceText);
                        if (props && props.length >= 2) {
                            patterns.push({ kind: 'classBody', range: runRange, properties: props });
                        }
                    }
                }
                currentRun = [];
            };

            for (const member of classBody.body) {
                if (member.type === 'PropertyDefinition' && !member.static) {
                    currentRun.push(member);
                } else {
                    flushRun();
                }
            }
            flushRun();
        }

        for (const key of Object.keys(node)) {
            if (key === 'parent') {continue;}
            const value = (node as unknown as Record<string, unknown>)[key];
            if (Array.isArray(value)) {
                for (const item of value) {
                    if (item && typeof item === 'object' && 'type' in item) {
                        walk(item as TSESTree.Node);
                    }
                }
            } else if (value && typeof value === 'object' && 'type' in value) {
                walk(value as TSESTree.Node);
            }
        }
    }

    walk(ast);
    return patterns;
}

function sortProperties(
    pattern: SortablePattern,
    sourceText: string
): Replacement | null {
    const { properties, range } = pattern;

    const restProps = properties.filter(p => p.isRest);
    const nonRestProps = properties.filter(p => !p.isRest);

    if (nonRestProps.length < 2) {return null;}

    const sorted = [...nonRestProps].sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name));

    // Check if already sorted
    const alreadySorted = sorted.every((p, i) => p.name === nonRestProps[i].name);
    if (alreadySorted) {return null;}

    // Reconstruct the block content
    const blockText = sourceText.slice(range[0], range[1]);
    const lines = blockText.split('\n');

    // Detect indentation from the first property line
    let indent = '    ';
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && trimmed !== '{' && trimmed !== '}') {
            const match = line.match(/^(\s+)/);
            if (match) {
                indent = match[1];
            }
            break;
        }
    }

    // For interfaces/types/classes, the separator (;) is included in the AST range of each property.
    // For destructuring, commas are OUTSIDE the AST range — we must add them ourselves.
    const separatorIncluded = pattern.kind === 'interfaceBody' || pattern.kind === 'typeLiteral' || pattern.kind === 'classBody';

    if (separatorIncluded) {
        // Properties already contain their separator — just reorder them
        const allSorted = [...sorted, ...restProps];
        const newLines: string[] = [];
        for (const prop of allSorted) {
            newLines.push(`${indent}${prop.text}`);
        }

        if (pattern.kind === 'classBody') {
            // No surrounding braces — range covers only the properties themselves
            return { range, newText: newLines.join('\n') };
        }

        const openingLine = lines[0];
        const closingLine = lines[lines.length - 1];
        return { range, newText: [openingLine, ...newLines, closingLine].join('\n') };
    }

    // Destructuring: detect trailing comma from text between last property and closing brace
    const lastProp = properties[properties.length - 1];
    const textAfterLastProp = sourceText.slice(lastProp.range[1], range[1]);
    const hasTrailingComma = /^\s*,/.test(textAfterLastProp);

    const allSorted = [...sorted, ...restProps];
    const newLines: string[] = [];

    for (let i = 0; i < allSorted.length; i++) {
        const propText = allSorted[i].text;
        const isLast = i === allSorted.length - 1;

        if (isLast) {
            newLines.push(`${indent}${propText}${hasTrailingComma ? ',' : ''}`);
        } else {
            newLines.push(`${indent}${propText},`);
        }
    }

    const openingLine = lines[0];
    const closingLine = lines[lines.length - 1];
    return { range, newText: [openingLine, ...newLines, closingLine].join('\n') };
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

export function sortDestructuring(sourceText: string, config?: Config): string {
    let ast: TSESTree.Program;
    try {
        ast = parse(sourceText, {
            range: true,
            loc: true,
            jsx: true,
        }) as TSESTree.Program;
    } catch {
        // If parsing fails, return original text unchanged
        return sourceText;
    }

    const patterns = findSortablePatterns(ast, sourceText, config);
    const replacements: Replacement[] = [];

    for (const pattern of patterns) {
        const replacement = sortProperties(pattern, sourceText);
        if (replacement) {
            replacements.push(replacement);
        }
    }

    if (replacements.length === 0) {return sourceText;}

    return applyReplacements(sourceText, replacements);
}
