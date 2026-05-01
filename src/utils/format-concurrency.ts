export interface VersionedDocumentSnapshot {
    uri: string;
    version: number;
    text: string;
}

interface SnapshotSource {
    uri: { toString(): string };
    version: number;
    getText(): string;
}

export function createDocumentSnapshot(document: SnapshotSource): VersionedDocumentSnapshot {
    return {
        uri: document.uri.toString(),
        version: document.version,
        text: document.getText(),
    };
}

export function hasDocumentChanged(document: SnapshotSource, snapshot: VersionedDocumentSnapshot): boolean {
    return document.version !== snapshot.version || document.getText() !== snapshot.text;
}

export class FormattingRetryScheduler {
    private pending = new Map<string, ReturnType<typeof setTimeout>>();
    private cooldowns = new Map<string, ReturnType<typeof setTimeout>>();

    constructor(
        private readonly onRetry: (documentKey: string) => void,
        private readonly delayMs = 150,
        private readonly cooldownMs = 2000
    ) {}

    schedule(documentKey: string): boolean {
        if (this.cooldowns.has(documentKey)) {
            return false;
        }

        const existing = this.pending.get(documentKey);
        if (existing) {
            clearTimeout(existing);
        }

        const timer = setTimeout(() => {
            this.pending.delete(documentKey);
            this.onRetry(documentKey);

            const cooldownTimer = setTimeout(() => {
                const activeCooldown = this.cooldowns.get(documentKey);
                if (activeCooldown === cooldownTimer) {
                    this.cooldowns.delete(documentKey);
                }
            }, this.cooldownMs);

            this.cooldowns.set(documentKey, cooldownTimer);
        }, this.delayMs);

        this.pending.set(documentKey, timer);
        return true;
    }

    isPending(documentKey: string): boolean {
        return this.pending.has(documentKey);
    }

    dispose(): void {
        for (const timer of this.pending.values()) {
            clearTimeout(timer);
        }

        for (const timer of this.cooldowns.values()) {
            clearTimeout(timer);
        }

        this.pending.clear();
        this.cooldowns.clear();
    }
}
