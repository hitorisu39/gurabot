import { Command, Help, Examples, Import, Inject, IsString, Option, Category } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { CommandOption, ECommandCategory } from "@domain/core/Command";
import { Embed } from "@/core/discord/ui/Embed";
import { GuildService } from "@/modules/guild/Guild.service";
import { levenshtein } from "@domain/utils/utils";

@Category(ECommandCategory.General)
@Command({
    name: "help",
    description: "Shows help for commands.",
    aliases: ["h"],
    defer: false,
})
@Help(`
    Displays detailed information, examples and aliases for a specific command.
`)
@Examples("help recent", "h rs")
export class HelpCommand extends AbstractCommand {
    @Import() declare private readonly guildService: GuildService;

    @Option("command", "Command to get help for")
    @IsString()
    @Inject()
    declare private readonly commandName: CommandOption<string>;

    public async execute(ctx: CommandContext): Promise<void> {
        const prefix = ctx.isSlash ? "/" : await this.guildService.getPrefix(ctx.guild?.id ?? null);

        if (!this.commandName.some()) {
            const embed = new Embed().addFields(
                {
                    name: "Command List",
                    value: `${prefix}commands`,
                    inline: true,
                },
                {
                    name: "Discord Server",
                    value: `[Join](${this.config.app.supportServer})`,
                    inline: true,
                },
                {
                    name: "Bot Invite",
                    value: `[Click](${this.config.app.invite})`,
                    inline: true,
                },
                {
                    name: "Tips",
                    value: `To get more information about a certain command, type \`${prefix}help [command]\`.`,
                    inline: false,
                },
            );

            await ctx.respond(embed);
            return;
        }

        const input = this.commandName.unwrap().toLowerCase().trim();
        const router = this.discord.commandRouter;
        const targetCommand = router.getCommand(input);

        if (!targetCommand) {
            const allNames = router.getAllCommandNames();
            let closest = "";
            let minDistance = Infinity;

            for (const name of allNames) {
                const distance = levenshtein(input, name);
                if (distance < minDistance) {
                    minDistance = distance;
                    closest = name;
                }
            }

            if (minDistance <= 3 && closest) {
                await ctx.respond(Embed.error(`Command \`${input}\` doesn't exist. Did you mean \`${closest}\`?`));
            } else {
                await ctx.respond(Embed.error(`Command \`${input}\` doesn't exist.`));
            }
            return;
        }

        const options = router.getCommandOptions(targetCommand);
        const helpText = router.getCommandHelp(targetCommand);
        const examples = router.getCommandExamples(targetCommand);
        const guildOnly = router.isCommandGuildOnly(targetCommand);

        let descriptionText = helpText ?? options.description ?? "No description provided.";

        const context = targetCommand.getHelpContext();

        for (const [key, value] of Object.entries(context)) {
            descriptionText = descriptionText.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
        }

        descriptionText = descriptionText.replace(/^[ \t]+/gm, "").trim();

        const commandDisplayName = router.getCommandDisplayName(targetCommand);
        const embed = new Embed().setAuthor({ name: commandDisplayName }).setDescription(descriptionText);

        if (examples.length > 0) {
            const examplesText = examples.map((example) => `\`${prefix}${example}\``).join("\n");

            embed.addFields({
                name: "Examples",
                value: examplesText,
                inline: true,
            });
        }

        const aliases = options.aliases?.length ? options.aliases.map((alias) => `\`${alias}\``).join(", ") : "None";

        embed
            .addFields({
                name: "Aliases",
                value: aliases,
                inline: true,
            })
            .setFooter({
                text: guildOnly ? "Available only in servers" : "Available in servers and DM",
            });

        await ctx.respond(embed);
    }
}
