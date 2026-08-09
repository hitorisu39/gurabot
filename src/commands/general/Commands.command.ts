import { Category, Command, Examples, Help, Import } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { Embed } from "@/core/discord/ui/Embed";
import { AbstractSessionCommand } from "@/commands/AbstractSessionCommand";
import { ECommandCategory } from "@domain/core/Command";
import { CommandsViewService } from "@/modules/general/commands/CommandsView.service";
import { CommandsViewDto } from "@domain/general/views/Commands.view";

@Category(ECommandCategory.General)
@Command({
    name: "commands",
    description: "Sends you a list of available prefix commands.",
    aliases: ["cmds"],
})
@Help(`
    Sends you a direct message containing all available
    prefix commands and their descriptions.
`)
@Examples("commands", "cmds")
export class CommandsCommand extends AbstractSessionCommand {
    @Import() declare private readonly commandsViewService: CommandsViewService;

    public async execute(ctx: CommandContext): Promise<void> {
        const data: CommandsViewDto = {
            authorID: ctx.author.id,
            category: ECommandCategory.General,
        };

        if (!ctx.guild) {
            await this.respondWithSession(ctx, "general_commands_view", data, this.commandsViewService);
            return;
        }

        try {
            await this.sendToWithSession(ctx, ctx.author, "general_commands_view", data, this.commandsViewService);
            await ctx.respond(Embed.general("Check your DMs for the command list."));
        } catch {
            await ctx.respond(
                Embed.error(
                    "I couldn't send you a DM. Please enable direct messages from server members and try again.",
                ),
            );
        }
    }
}
