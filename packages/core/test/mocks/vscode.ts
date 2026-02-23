import { join } from 'node:path';

export class EventEmitter {
    listeners: any[] = [];

    event = (listener: any) => {
        this.listeners.push(listener);
        return {
            dispose: () => {
                const index = this.listeners.indexOf(listener);
                if (index !== -1) {
                    this.listeners.splice(index, 1);
                }
            }
        };
    };

    fire(event: any) {
        this.listeners.forEach(listener => listener(event));
    }
}

export const window = {
    createOutputChannel: (_name: any) => ({
        appendLine: () => {},
        show: () => {},
        clear: () => {}
    }),
    showInformationMessage: () => {},
    showErrorMessage: () => {}
};

export class Position {
    line: number;
    character: number;
    constructor(line: any, character: any) {
        this.line = line;
        this.character = character;
    }
}

export class Range {
    start: any;
    end: any;
    constructor(start: any, end: any) {
        this.start = start;
        this.end = end;
    }

    get isEmpty() { return this.start.line === this.end.line && this.start.character === this.end.character; }
    get isSingleLine() { return this.start.line === this.end.line; }
    contains() { return false; }
    isEqual() { return false; }
    intersection() { return null; }
    union() { return this; }
    with() { return this; }
}

export class Diagnostic {
    range: any;
    message: any;
    severity: any;
    code: any = undefined;
    source: any = undefined;
    constructor(range: any, message: any, severity: any) {
        this.range = range;
        this.message = message;
        this.severity = severity;
    }
}

export const DiagnosticSeverity = {
    Error: 0,
    Warning: 1,
    Information: 2,
    Hint: 3
};

export const workspace = {
    getConfiguration: (section: any) => {
        const mockConfig = {
            get: (key: any, defaultValue: any) => {
                if (section === 'tidyjs' && key === 'debug') {
                    return false;
                }
                return defaultValue !== undefined ? defaultValue : {};
            },
            has: (_key: any) => {
                return false;
            }
        };
        return mockConfig;
    },
    getWorkspaceFolder: (uri: any) => {
        if (!uri) { return undefined; }
        return {
            uri: {
                fsPath: '/workspace',
                path: '/workspace',
                scheme: 'file'
            },
            name: 'workspace',
            index: 0
        };
    }
};

export class Uri {
    scheme: string;
    authority: string;
    path: string;
    query: string;
    fragment: string;
    fsPath: string;

    constructor(scheme?: string, authority?: string, path?: string, query?: string, fragment?: string) {
        this.scheme = scheme || 'file';
        this.authority = authority || '';
        this.path = path || '';
        this.query = query || '';
        this.fragment = fragment || '';
        this.fsPath = path || '';
    }

    static file(path: string) {
        const uri = new Uri('file', '', path);
        uri.fsPath = path;
        return uri;
    }

    static parse(str: string) {
        return new Uri('file', '', str);
    }

    static joinPath(base: Uri, ...pathSegments: string[]) {
        const joined = join(base.fsPath, ...pathSegments);
        return Uri.file(joined);
    }

    toString() {
        return `${this.scheme}://${this.path}`;
    }
}
