import { ICoreEvents } from "@/core/events";
import { IApplicationContext } from "../types";

export abstract class AbstractService {
    declare protected readonly logger: IApplicationContext["logger"];
    declare protected readonly repository: IApplicationContext["repository"];
    declare protected readonly config: IApplicationContext["config"];
    declare protected readonly discord: IApplicationContext["discord"];
    declare protected readonly dispatcher: IApplicationContext["dispatcher"];
    declare protected readonly cache: IApplicationContext["cache"];
    declare protected readonly adapter: IApplicationContext["adapter"];
    declare protected readonly calculator: IApplicationContext["calculator"];

    constructor(protected readonly ctx: IApplicationContext) {
        this.logger = ctx.logger.child({ name: this.constructor.name });
        this.repository = ctx.repository;
        this.config = ctx.config;
        this.discord = ctx.discord;
        this.dispatcher = ctx.dispatcher;
        this.cache = ctx.cache;
        this.adapter = ctx.adapter;
        this.calculator = ctx.calculator;
    }

    protected dispatch<D extends keyof ICoreEvents, E extends keyof ICoreEvents[D]>(
        domain: D,
        event: E,
        ...args: Parameters<ICoreEvents[D][E] extends (...args: any) => any ? ICoreEvents[D][E] : never>
    ): void {
        this.dispatcher.dispatch(domain, event, ...args);
    }

    protected async dispatchAsync<D extends keyof ICoreEvents, E extends keyof ICoreEvents[D]>(
        domain: D,
        event: E,
        ...args: Parameters<ICoreEvents[D][E] extends (...args: any) => any ? ICoreEvents[D][E] : never>
    ): Promise<void> {
        await this.dispatcher.dispatchAsync(domain, event, ...args);
    }
}
