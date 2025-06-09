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
        getConfiguration: () => ({
            get: () => ({})
        })
    },
    EventEmitter
};
