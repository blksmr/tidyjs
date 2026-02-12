export interface ASTNode {
    type: string;
    range?: [number, number];
    start?: number;
    end?: number;
    [key: string]: unknown;
}

export interface Program extends ASTNode {
    type: 'Program';
    body: ASTNode[];
}

export interface ImportDeclaration extends ASTNode {
    type: 'ImportDeclaration';
    source: { value: string };
    importKind: 'value' | 'type';
    specifiers: ASTNode[];
}

export interface ImportSpecifier extends ASTNode {
    type: 'ImportSpecifier';
    imported: { type: string; name: string };
    local: { type: string; name: string };
    importKind: 'value' | 'type';
}

export interface ImportDefaultSpecifier extends ASTNode {
    type: 'ImportDefaultSpecifier';
    local: { type: string; name: string };
}

export interface ImportNamespaceSpecifier extends ASTNode {
    type: 'ImportNamespaceSpecifier';
    local: { type: string; name: string };
}

export interface ExportNamedDeclaration extends ASTNode {
    type: 'ExportNamedDeclaration';
    source: { value: string } | null;
    exportKind: 'value' | 'type';
    specifiers: ExportSpecifier[];
}

export interface ExportSpecifier extends ASTNode {
    type: 'ExportSpecifier';
    exported: { type: string; name?: string; value?: string };
    local: { type: string; name?: string; value?: string };
}

export interface Property extends ASTNode {
    type: 'Property';
    key: { type: string; name?: string; value?: unknown };
    computed: boolean;
}

export interface TSEnumDeclaration extends ASTNode {
    type: 'TSEnumDeclaration';
    body?: { members: ASTNode[] };
    members?: ASTNode[];
}

export interface TSEnumMember extends ASTNode {
    type: 'TSEnumMember';
    id: { type: string; name?: string; value?: unknown };
}

export interface TSPropertySignature extends ASTNode {
    type: 'TSPropertySignature';
    key: { type: string; name?: string; value?: unknown };
    computed: boolean;
}

export interface TSMethodSignature extends ASTNode {
    type: 'TSMethodSignature';
    key: { type: string; name?: string };
    computed: boolean;
}

export interface PropertyDefinition extends ASTNode {
    type: 'PropertyDefinition';
    key: { type: string; name?: string; value?: unknown };
    computed: boolean;
    static: boolean;
}

export interface ClassBody extends ASTNode {
    type: 'ClassBody';
    body: ASTNode[];
}
