class EventEmitter {
    constructor() {
        this.listeners = [];
    }

    event = (listener) => {
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

    fire(event) {
        this.listeners.forEach(listener => listener(event));
    }
}

module.exports = {
    window: {
        createOutputChannel: (name) => ({
            appendLine: () => {},
            show: () => {},
            clear: () => {}
        }),
        showInformationMessage: () => {},
        showErrorMessage: () => {}
    },
    Position: class Position {
        constructor(line, character) {
            this.line = line;
            this.character = character;
        }
    },
    Range: class Range {
        constructor(start, end) {
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
    },
    Diagnostic: class Diagnostic {
        constructor(range, message, severity) {
            this.range = range;
            this.message = message;
            this.severity = severity;
            this.code = undefined;
            this.source = undefined;
        }
    },
    DiagnosticSeverity: {
        Error: 0,
        Warning: 1,
        Information: 2,
        Hint: 3
    },
    workspace: {
        getConfiguration: (section) => {
            const mockConfig = {
                get: (key, defaultValue) => {
                    if (section === 'tidyjs' && key === 'debug') {
                        return false; // Default debug to false in tests
                    }
                    return defaultValue !== undefined ? defaultValue : {};
                },
                has: (key) => {
                    // Mock has method
                    return false; // Return false for all keys in tests
                }
            };
            return mockConfig;
        },
        getWorkspaceFolder: (uri) => {
            if (!uri) return undefined;
            // Return a mock workspace folder
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
    },
    Uri: class Uri {
        constructor(scheme, authority, path, query, fragment) {
            this.scheme = scheme || 'file';
            this.authority = authority || '';
            this.path = path || '';
            this.query = query || '';
            this.fragment = fragment || '';
            this.fsPath = path || '';
        }

        static file(path) {
            const uri = new Uri('file', '', path);
            uri.fsPath = path;
            return uri;
        }

        static parse(str) {
            return new Uri('file', '', str);
        }

        static joinPath(base, ...pathSegments) {
            const path = require('path');
            const joined = path.join(base.fsPath, ...pathSegments);
            return Uri.file(joined);
        }

        toString() {
            return `${this.scheme}://${this.path}`;
        }
    },
    EventEmitter
};
