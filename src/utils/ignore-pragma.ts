/**
 * Check if the document contains a tidyjs-ignore pragma comment.
 * Matches `// tidyjs-ignore` on its own line (with optional surrounding whitespace).
 * Ignores matches inside template literals and string literals to avoid false positives.
 */
export function hasIgnorePragma(text: string): boolean {
    const pragmaPattern = /^\s*\/\/\s*tidyjs-ignore\s*$/;
    const lines = text.split('\n');
    let inTemplate = false;

    for (const line of lines) {
        if (!inTemplate && pragmaPattern.test(line)) {
            return true;
        }

        // Count backticks outside of string literals to track template literal state
        let backticks = 0;
        let inSingle = false;
        let inDouble = false;

        for (let i = 0; i < line.length; i++) {
            const ch = line[i];

            if (ch === '\\') {
                i++; // skip next character (escape sequence)
                continue;
            }

            if (inTemplate) {
                if (ch === '`') { backticks++; }
            } else if (inSingle) {
                if (ch === "'") { inSingle = false; }
            } else if (inDouble) {
                if (ch === '"') { inDouble = false; }
            } else {
                if (ch === "'") { inSingle = true; }
                else if (ch === '"') { inDouble = true; }
                else if (ch === '`') { backticks++; }
                else if (ch === '/' && i + 1 < line.length && line[i + 1] === '/') {
                    break; // rest of line is a comment
                }
            }
        }

        if (backticks % 2 !== 0) {
            inTemplate = !inTemplate;
        }
    }

    return false;
}
