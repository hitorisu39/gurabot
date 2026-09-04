import { ICoreEvents } from "@/core/events";
import { TLogger } from "./types";

export class Dispatcher {
    private listeners = new Map<string, Array<Function>>();

    constructor(private readonly logger: TLogger) {}

    public on<D extends keyof ICoreEvents, E extends keyof ICoreEvents[D]>(
        domain: D,
        event: E,
        handler: Function,
    ): void {
        const eventName = `${String(domain)}:${String(event)}`;
        const current = this.listeners.get(eventName) || [];
        this.listeners.set(eventName, [...current, handler]);
    }

    public dispatch<D extends keyof ICoreEvents, E extends keyof ICoreEvents[D]>(
        domain: D,
        event: E,
        ...args: Parameters<ICoreEvents[D][E] extends (...args: any) => any ? ICoreEvents[D][E] : never>
    ): void {
        const eventName = `${String(domain)}:${String(event)}`;
        const handlers = this.listeners.get(eventName) || [];

        for (const handler of handlers) {
            Promise.resolve()
                .then(() => handler(...args))
                .catch((err) => {
                    this.logger.error(err, `Unhandled error in event handler`);
                });
        }
    }

    public async dispatchAsync<D extends keyof ICoreEvents, E extends keyof ICoreEvents[D]>(
        domain: D,
        event: E,
        ...args: Parameters<ICoreEvents[D][E] extends (...args: any) => any ? ICoreEvents[D][E] : never>
    ): Promise<void> {
        const eventName = `${String(domain)}:${String(event)}`;
        const handlers = this.listeners.get(eventName) || [];

        const executions = handlers.map((handler) => Promise.resolve(handler(...args)));
        await Promise.all(executions);
    }
}
