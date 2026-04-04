import { Import, Middleware } from "@/core/decorators";
import { AbstractMiddleware } from "@/core/discord/middleware/AbstractMiddleware";
import { ThrottlerService } from "./Throttler.service";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { Embed } from "@/core/discord/ui/Embed";
import { EMiddlewarePriority } from "@domain/core/Middleware";
import { Message } from "discord.js";

/**
 * The middleware responsible for command execution cooldown.
 */
@Middleware({ priority: EMiddlewarePriority.Throttler })
export class ThrottlerMiddleware extends AbstractMiddleware {
    @Import() declare private readonly throttlerService: ThrottlerService;

    /**
     * Default throttler cooldown in seconds.
     * Works "per user per command".
     */
    private readonly cooldownDefault = 2; // seconds

    /**
     * The time in seconds after which the warning message
     * about the cooldown will be deleted.
     */
    private readonly cooldownAutoDelete = 3; // seconds

    public async execute(ctx: CommandContext, next: () => Promise<void>): Promise<void> {
        const cooldownSeconds = ctx.metadata.options.cooldown ?? this.cooldownDefault;
        const cooldownKey = `${ctx.author.id}:${ctx.commandName}`;

        const timeLeft = this.throttlerService.consume(cooldownKey, cooldownSeconds);
        if (timeLeft !== false) {
            const warning = await ctx.followUp(
                Embed.warn(`Wait ${timeLeft.toFixed(1)}s before using this command again.`),
            );
            setTimeout(() => {
                if (warning instanceof Message && warning?.deletable) warning.delete().catch(() => {});
            }, this.cooldownAutoDelete * 1000);

            return;
        }

        await next();
    }
}
