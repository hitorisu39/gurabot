import { IApplicationContext } from "../types";
import { CommandContext } from "./context/CommandContext";

export abstract class AbstractCommand {
    protected readonly logger: IApplicationContext["logger"];
    protected readonly config: IApplicationContext["config"];
    protected readonly discord: IApplicationContext["discord"];
    protected readonly adapter: IApplicationContext["adapter"];
    protected readonly calculator: IApplicationContext["calculator"];
    protected readonly cache: IApplicationContext["cache"];

    constructor(protected readonly ctx: IApplicationContext) {
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.discord = ctx.discord;
        this.adapter = ctx.adapter;
        this.calculator = ctx.calculator;
        this.cache = ctx.cache;
    }

    /**
     * Method responsible for executing command logic.
     *
     * @param ctx Command context
     */
    public abstract execute(ctx: CommandContext): Promise<void> | void;

    /**
     * Provides variables for template strings in the command's @Help decorator.
     * Can be overridden by subclasses to inject dynamic context.
     */
    public getHelpContext(): Record<string, string> {
        return {};
    }
}
