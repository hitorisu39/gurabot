import { Command, Examples, Help, Import } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { Embed } from "@/core/discord/ui/Embed";
import { GuildService } from "@/modules/guild/Guild.service";

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
export class CommandsCommand extends AbstractCommand {
    @Import() declare private readonly guildService: GuildService;

    public async execute(ctx: CommandContext): Promise<void> {
        const prefix = await this.guildService.getPrefix(ctx.guild?.id ?? null);
        const pages = this.createCommandPages();

        try {
            for (const [index, page] of pages.entries()) {
                const title = pages.length > 1 ? `Command List | ${index + 1}/${pages.length}` : "Command List";

                const embed = new Embed()
                    .setAuthor({ name: title })
                    .setDescription(page)
                    .setFooter({
                        text: `Use ${prefix}help [command] for more information.`,
                    });

                await ctx.author.send({
                    embeds: [embed],
                });
            }

            if (ctx.guild) await ctx.respond(Embed.general("Check your DMs for the command list."));
        } catch {
            await ctx.respond(
                Embed.error(
                    "I couldn't send you a DM. Please enable direct messages from server members and try again.",
                ),
            );
        }
    }

    private createCommandPages(): Array<string> {
        const router = this.discord.commandRouter;

        const lines = router
            .getPrefixCommandEntries()
            .map(({ name, command }) => {
                const options = router.getCommandOptions(command);
                const description = this.normalizeDescription(options?.description);
                return `\`${name}\`: ${description}`;
            })
            .sort((a, b) => a.localeCompare(b));

        if (lines.length === 0) {
            return ["No prefix commands are currently available."];
        }

        const pages: Array<string> = [];
        const maxPageLength = 3_900;

        let currentPage = "";

        for (const line of lines) {
            const nextPage = currentPage ? `${currentPage}\n${line}` : line;

            if (currentPage && nextPage.length > maxPageLength) {
                pages.push(currentPage);
                currentPage = line;
            } else {
                currentPage = nextPage;
            }
        }

        if (currentPage) {
            pages.push(currentPage);
        }

        return pages;
    }

    private normalizeDescription(description: string | undefined): string {
        const normalized = description?.replace(/\s+/g, " ").trim();

        if (!normalized) {
            return "No description provided.";
        }

        if (normalized.length > 500) {
            return `${normalized.slice(0, 497)}...`;
        }

        return normalized;
    }
}
