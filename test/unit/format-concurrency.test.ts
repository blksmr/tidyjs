import {
    createDocumentSnapshot,
    FormattingRetryScheduler,
    hasDocumentChanged,
} from '../../src/utils/format-concurrency';

describe('format concurrency guards', () => {
    it('detects document changes from a snapshot', () => {
        const document = {
            uri: { toString: () => 'file:///demo.ts' },
            version: 1,
            getText: () => 'import a from \'a\';',
        };

        const snapshot = createDocumentSnapshot(document);

        expect(hasDocumentChanged(document, snapshot)).toBe(false);

        const changedDocument = {
            ...document,
            version: 2,
            getText: () => 'import b from \'b\';',
        };

        expect(hasDocumentChanged(changedDocument, snapshot)).toBe(true);
    });

    it('deduplicates pending retries and enforces a short cooldown', () => {
        jest.useFakeTimers();

        const onRetry = jest.fn();
        const scheduler = new FormattingRetryScheduler(onRetry, 50, 100);

        expect(scheduler.schedule('file:///demo.ts')).toBe(true);
        expect(scheduler.isPending('file:///demo.ts')).toBe(true);

        expect(scheduler.schedule('file:///demo.ts')).toBe(true);

        jest.advanceTimersByTime(49);
        expect(onRetry).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1);
        expect(onRetry).toHaveBeenCalledTimes(1);
        expect(scheduler.isPending('file:///demo.ts')).toBe(false);

        expect(scheduler.schedule('file:///demo.ts')).toBe(false);

        jest.advanceTimersByTime(100);
        expect(scheduler.schedule('file:///demo.ts')).toBe(true);

        scheduler.dispose();
        jest.useRealTimers();
    });
});
