export interface TextReplacement {
    start: number;
    end: number;
    newText: string;
}

export function getMinimalTextReplacement(originalText: string, updatedText: string): TextReplacement | null {
    if (originalText === updatedText) {
        return null;
    }

    const sharedLength = Math.min(originalText.length, updatedText.length);
    let start = 0;

    while (start < sharedLength && originalText[start] === updatedText[start]) {
        start++;
    }

    let originalEnd = originalText.length;
    let updatedEnd = updatedText.length;

    while (
        originalEnd > start
        && updatedEnd > start
        && originalText[originalEnd - 1] === updatedText[updatedEnd - 1]
    ) {
        originalEnd--;
        updatedEnd--;
    }

    return {
        start,
        end: originalEnd,
        newText: updatedText.slice(start, updatedEnd),
    };
}
