import { Import, Trace } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { SessionService } from "@/modules/cache/Session.service";
import { InteractionResponse, Message, TextBasedChannel, User } from "discord.js";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { ICacheSchema } from "@domain/core/Cache";
import { AbstractViewService } from "@/modules/AbstractViewService";

export abstract class AbstractSessionCommand extends AbstractCommand {
    @Import() declare protected readonly sessionService: SessionService;

    @Trace()
    protected async respondWithSession<K extends keyof ICacheSchema, TOptions>(
        ctx: CommandContext,
        sessionType: K,
        data: ICacheSchema[K],
        viewService: AbstractViewService<ICacheSchema[K], TOptions>,
        options?: TOptions,
    ): Promise<{ message: Message | InteractionResponse | null; sessionID: string }> {
        const sessionID = await this.sessionService.create(sessionType, data, viewService.getTtl());
        const view = await viewService.build(sessionID, data, options);
        const message = await ctx.respond(view);

        if (message) {
            this.sessionService.after(sessionID, () => {
                if (message instanceof Message) {
                    if (message.components.length) {
                        message.edit({ components: [] }).catch(() => null);
                    }
                } else {
                    message.edit({ components: [] }).catch(() => null);
                }
            });
        }

        return { message, sessionID };
    }

    @Trace()
    protected async sendToWithSession<K extends keyof ICacheSchema, TOptions>(
        ctx: CommandContext,
        target: User | TextBasedChannel,
        sessionType: K,
        data: ICacheSchema[K],
        viewService: AbstractViewService<ICacheSchema[K], TOptions>,
        options?: TOptions,
    ): Promise<{ message: Message | null; sessionID: string }> {
        const sessionID = await this.sessionService.create(sessionType, data, viewService.getTtl());
        const view = await viewService.build(sessionID, data, options);
        const message = await ctx.sendTo(target, view);

        if (message) {
            this.sessionService.after(sessionID, () => {
                if (message.components.length) {
                    message.edit({ components: [] }).catch(() => null);
                }
            });
        }

        return {
            message,
            sessionID,
        };
    }
}
