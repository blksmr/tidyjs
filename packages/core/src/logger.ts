export interface Logger {
    debug(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
}

const noopLogger: Logger = {
    debug: () => {},
    error: () => {},
};

let currentLogger: Logger = noopLogger;

export function setLogger(logger: Logger): void {
    currentLogger = logger;
}

export function logDebug(message: string, ...args: unknown[]): void {
    currentLogger.debug(message, ...args);
}

export function logError(message: string, ...args: unknown[]): void {
    currentLogger.error(message, ...args);
}
