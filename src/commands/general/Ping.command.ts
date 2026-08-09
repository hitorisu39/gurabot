import { Category, Command } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { Embed } from "@/core/discord/ui/Embed";
import { ECommandCategory } from "@domain/core/Command";

@Category(ECommandCategory.General)
@Command({
    name: "ping",
    description: "Replies with Pong and latency!",
    aliases: ["p"],
})
export class PingCommand extends AbstractCommand {
    public async execute(ctx: CommandContext): Promise<void> {
        const start = Date.now();
        await ctx.respond(Embed.success("Pinging..."));
        await ctx.respond(Embed.success(`Pong! 🏓 Latency: ${Date.now() - start}ms`));
    }
}
