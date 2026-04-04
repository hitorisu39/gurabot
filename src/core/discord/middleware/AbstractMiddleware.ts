import { IApplicationContext } from "@/core/types";
import { CommandContext } from "../context/CommandContext";

export abstract class AbstractMiddleware {
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

    /**
     * @param ctx The command context
     * @param next Call this to proceed to the next middleware or the actual command
     */
    public abstract execute(ctx: CommandContext, next: () => Promise<void>): Promise<void> | void;
}
