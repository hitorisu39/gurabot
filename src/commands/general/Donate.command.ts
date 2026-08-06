import { Command } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { Embed } from "@/core/discord/ui/Embed";

@Command({
    name: "donate",
    description: "Sends a ko-fi link to support the project.",
    defer: false,
})
export class DonateCommand extends AbstractCommand {
    public async execute(ctx: CommandContext): Promise<void> {
        await ctx.respond(Embed.success(`You can support ${this.config.app.name} project here: ${this.config.app.donate}`));
    }
}
