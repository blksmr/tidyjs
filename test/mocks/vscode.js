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
    },
    workspace: {
        getConfiguration: () => ({
            get: () => ({})
        })
    },
    EventEmitter
};
