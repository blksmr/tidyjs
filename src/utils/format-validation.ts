import type { ImportParser } from '../parser';

export function validateFormattedOutput(
    parser: ImportParser,
    sourceText: string,
    fileName?: string
): string | undefined {
    const validationResult = parser.parse(sourceText, undefined, undefined, fileName);

    if (validationResult.invalidImports && validationResult.invalidImports.length > 0) {
        return validationResult.invalidImports[0].error;
    }

    return undefined;
}
