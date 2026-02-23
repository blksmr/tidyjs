export interface IRText {
    kind: 'text';
    value: string;
}

export interface IRHardLine {
    kind: 'hardLine';
}

export interface IRIndent {
    kind: 'indent';
    count: number;
    content: IRNode;
}

export interface IRConcat {
    kind: 'concat';
    parts: IRNode[];
}

/**
 * Alignment anchor — the point where `from` should be aligned.
 * `prefix` is everything before the `from` keyword.
 * `suffix` is `from '...';\n` etc.
 * `idealWidth` overrides the measured prefix width (for multiline imports
 * where the alignment column depends on the longest specifier, not the closing `}`).
 */
export interface IRAlignAnchor {
    kind: 'alignAnchor';
    groupId: string;
    prefix: IRNode;
    suffix: IRNode;
    idealWidth?: number;
}

/**
 * Groups anchors that share the same alignment column.
 * All `IRAlignAnchor` nodes inside an `IRAlignGroup` with the same
 * `groupId` will be padded to the same column.
 */
export interface IRAlignGroup {
    kind: 'alignGroup';
    groupId: string;
    children: IRNode[];
}

export interface IRDocument {
    kind: 'document';
    children: IRNode[];
}

export type IRNode =
    | IRText
    | IRHardLine
    | IRIndent
    | IRConcat
    | IRAlignAnchor
    | IRAlignGroup
    | IRDocument;
