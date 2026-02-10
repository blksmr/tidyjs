import { parseSync } from 'oxc-parser';
import type { Program } from '../types/ast';

export function parseSource(
    sourceText: string,
    options?: { jsx?: boolean; fileName?: string }
): Program {
    const fileName = options?.fileName
        ?? (options?.jsx !== false ? 'file.tsx' : 'file.ts');

    const lang = fileName.endsWith('.tsx') || fileName.endsWith('.jsx') ? 'tsx' : 'ts';

    const result = parseSync(fileName, sourceText, {
        sourceType: 'module',
        lang,
        range: true,
    });

    if (result.errors.length > 0) {
        throw new SyntaxError(result.errors[0].message);
    }

    return result.program as unknown as Program;
}
