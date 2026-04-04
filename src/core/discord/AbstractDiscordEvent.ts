import { ClientEvents } from "discord.js";
import { IApplicationContext } from "../types";

export abstract class AbstractDiscordEvent<K extends keyof ClientEvents> {
    public abstract readonly event: K;
    public readonly once: boolean = false;

    protected readonly logger: IApplicationContext["logger"];
    protected readonly dispatcher: IApplicationContext["dispatcher"];
    protected readonly config: IApplicationContext["config"];
    protected readonly discord: IApplicationContext["discord"];

    constructor(protected readonly ctx: IApplicationContext) {
        this.logger = ctx.logger.child({ name: this.constructor.name });
        this.dispatcher = ctx.dispatcher;
        this.config = ctx.config;
        this.discord = ctx.discord;
    }

    public abstract execute(...args: ClientEvents[K]): Promise<void> | void;
}
