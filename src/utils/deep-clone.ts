/**
 * Deep clones a value, applying a customizer function to each value.
 * If the customizer returns undefined, the default cloning logic is used.
 * Handles plain objects, arrays, RegExp, Date, and primitives.
 */
export function cloneDeepWith<T>(value: T, customizer: (val: unknown) => unknown): T {
    function clone(val: unknown): unknown {
        const customResult = customizer(val);
        if (customResult !== undefined) {
            return customResult;
        }

        if (val === null || typeof val !== 'object') {
            return val;
        }

        if (val instanceof RegExp) {
            return new RegExp(val.source, val.flags);
        }

        if (val instanceof Date) {
            return new Date(val.getTime());
        }

        if (Array.isArray(val)) {
            return val.map(clone);
        }

        const result: Record<string, unknown> = {};
        for (const key of Object.keys(val as Record<string, unknown>)) {
            result[key] = clone((val as Record<string, unknown>)[key]);
        }
        return result;
    }

    return clone(value) as T;
}
