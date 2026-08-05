import { Command } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { Embed } from "@/core/discord/ui/Embed";

@Command({
    name: "invite",
    description: "Sends an invite link to invite the bot to your server with support server invite link.",
    defer: false
})
export class InviteCommand extends AbstractCommand {
    public async execute(ctx: CommandContext): Promise<void> {
        await ctx.respond(
            Embed.success(
                `Invite bot to your server: ${this.config.app.invite}\nSupport server: ${this.config.app.supportServer}`,
            ),
        );
    }
}
