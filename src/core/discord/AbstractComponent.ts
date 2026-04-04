import { IApplicationContext } from "../types";
import { TMessagePayload } from "./context/CommandContext";
import { ComponentContext } from "./context/ComponentContext";

export abstract class AbstractComponent {
    protected readonly logger: IApplicationContext["logger"];
    protected readonly repository: IApplicationContext["repository"];
    protected readonly config: IApplicationContext["config"];
    protected readonly discord: IApplicationContext["discord"];

    constructor(protected readonly ctx: IApplicationContext) {
        this.logger = ctx.logger.child({ name: this.constructor.name });
        this.repository = ctx.repository;
        this.config = ctx.config;
        this.discord = ctx.discord;
    }

    protected async runWithLoading<T>(
        ctx: ComponentContext,
        task: () => Promise<T>,
        loadingMessage: TMessagePayload = { content: "Processing... please wait.", embeds: [], components: [] },
        timeout: number = 1000,
    ): Promise<T> {
        const taskPromise = task();
        const timeoutSymbol = Symbol("TIMEOUT");
        const timeoutPromise = new Promise<typeof timeoutSymbol>((resolve) =>
            setTimeout(() => resolve(timeoutSymbol), timeout),
        );

        const raceResult = await Promise.race([taskPromise, timeoutPromise]);

        if (raceResult === timeoutSymbol) {
            await ctx.update(loadingMessage).catch(() => null);
            return await taskPromise;
        }

        return raceResult as T;
    }

    public abstract execute(ctx: ComponentContext): Promise<void>;
}
