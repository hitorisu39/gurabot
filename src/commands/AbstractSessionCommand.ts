import { Trace } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { Message, TextBasedChannel, User } from "discord.js";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { ICacheSchema } from "@domain/core/Cache";
import type { AbstractView } from "@/core/discord/views/AbstractView";

export abstract class AbstractSessionCommand extends AbstractCommand {
    @Trace()
    protected async sendToWithSession<K extends keyof ICacheSchema, TOptions>(
        ctx: CommandContext,
        target: User | TextBasedChannel,
        sessionType: K,
        data: ICacheSchema[K],
        view: AbstractView<ICacheSchema[K], TOptions>,
        options?: TOptions,
    ): Promise<{
        message: Message | null;
        sessionID: string;
    }> {
        const sessionID = await this.session.create(sessionType, data, view.getTtl());
        const payload = await view.build(sessionID, data, options);
        const message = await ctx.sendTo(target, payload);

        await view.afterRespond(data, message);

        if (message) {
            this.session.after(sessionID, () => {
                if (!message.components.length) {
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
