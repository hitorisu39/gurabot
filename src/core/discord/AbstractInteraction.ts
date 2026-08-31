import { ICacheSchema } from "@domain/core/Cache";
import { IApplicationContext } from "../types";
import { InteractionContext } from "./context/InteractionContext";
import { AbstractView } from "./views/AbstractView";
import { InteractionResponse, Message } from "discord.js";

export abstract class AbstractInteraction {
    protected readonly logger: IApplicationContext["logger"];
    protected readonly repository: IApplicationContext["repository"];
    protected readonly config: IApplicationContext["config"];
    protected readonly discord: IApplicationContext["discord"];
    protected readonly adapter: IApplicationContext["adapter"];
    protected readonly calculator: IApplicationContext["calculator"];
    protected readonly cache: IApplicationContext["cache"];
    protected readonly session: IApplicationContext["session"];
    protected readonly dispatcher: IApplicationContext["dispatcher"];

    constructor(protected readonly ctx: IApplicationContext) {
        this.logger = ctx.logger.child({ name: this.constructor.name });
        this.repository = ctx.repository;
        this.config = ctx.config;
        this.discord = ctx.discord;
        this.adapter = ctx.adapter;
        this.calculator = ctx.calculator;
        this.cache = ctx.cache;
        this.session = ctx.session;
        this.dispatcher = ctx.dispatcher;
    }

    protected async respondWithSession<K extends keyof ICacheSchema, TOptions>(
        ctx: InteractionContext,
        sessionType: K,
        data: ICacheSchema[K],
        view: AbstractView<ICacheSchema[K], TOptions>,
        options?: TOptions,
    ): Promise<{
        message: Message | InteractionResponse | null;
        sessionID: string;
    }> {
        const sessionID = await this.session.create(sessionType, data, view.getTtl());
        const payload = await view.build(sessionID, data, options);
        const message = await ctx.respond(payload);

        await view.afterRespond(data, message);

        if (message) {
            this.session.after(sessionID, () => {
                if (message instanceof Message && !message.components.length) {
                    return;
                }

                message.edit({ components: [] }).catch(() => null);
            });
        }

        return {
            message,
            sessionID,
        };
    }
}
