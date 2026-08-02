export class ThrottledAsyncUpdater<T> {
    private readonly update: (value: T) => Promise<void>;
    private readonly onError: (error: unknown) => void;
    private readonly interval: number;

    private chain: Promise<void> = Promise.resolve();
    private timer?: NodeJS.Timeout;
    private pending?: T;
    private lastUpdateAt = 0;
    private closed = false;

    constructor(
        update: (value: T) => Promise<void>,
        interval: number = 4_000,
        onError: (error: unknown) => void = () => undefined,
    ) {
        this.update = update;
        this.interval = interval;
        this.onError = onError;
    }

    public push(value: T): void {
        if (this.closed) return;

        this.pending = value;
        this.schedule();
    }

    public async close(flush: boolean = false): Promise<void> {
        this.closed = true;

        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }

        const pending = this.pending;
        this.pending = undefined;

        if (flush && pending !== undefined) {
            await this.enqueue(pending);
        }

        await this.chain;
    }

    private schedule(): void {
        if (this.timer || this.closed) return;

        const elapsed = Date.now() - this.lastUpdateAt;
        const delay = Math.max(0, this.interval - elapsed);

        this.timer = setTimeout(() => {
            this.timer = undefined;

            const pending = this.pending;
            this.pending = undefined;

            if (pending !== undefined) void this.enqueue(pending);
            if (this.pending !== undefined) this.schedule();
        }, delay);
    }

    private async enqueue(value: T): Promise<void> {
        this.chain = this.chain
            .then(async () => {
                this.lastUpdateAt = Date.now();
                await this.update(value);
            })
            .catch((error) => {
                this.onError(error);
            });

        await this.chain;
    }
}
