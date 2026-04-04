import { Middleware } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractMiddleware } from "@/core/discord/middleware/AbstractMiddleware";
import { Embed } from "@/core/discord/ui/Embed";
import { EMiddlewarePriority } from "@domain/core/Middleware";

@Middleware({ priority: EMiddlewarePriority.Permission })
export class PermissionMiddleware extends AbstractMiddleware {
    public async execute(ctx: CommandContext, next: () => Promise<void>): Promise<void> {
        const isGuildOnly = ctx.metadata.guildOnly;
        const userPermissions = ctx.metadata.userPermissions;
        const botPermissions = ctx.metadata.botPermissions;

        if (isGuildOnly && !ctx.guild) {
            await ctx.respond(Embed.error("This command can only be used inside a server."));
            return;
        }

        if (ctx.guild && ctx.channel && !ctx.channel.isDMBased()) {
            if (botPermissions.length) {
                const member = ctx.guild.members.me;
                if (member) {
                    const missing = ctx.channel.permissionsFor(member).missing(botPermissions);
                    if (missing.length) {
                        await ctx.respond(
                            Embed.error(
                                `Missing the following permissions to execute this command: \`${missing.join(", ")}\``,
                            ),
                        );
                        return;
                    }
                }
            }

            if (userPermissions.length) {
                const missing = ctx.channel.permissionsFor(ctx.author.id)?.missing(userPermissions);
                if (missing && missing.length) {
                    await ctx.respond(
                        Embed.error(
                            `You are missing the following permissions to execute this command: \`${missing.join(", ")}\``,
                        ),
                    );
                    return;
                }
            }
        }

        await next();
    }
}
