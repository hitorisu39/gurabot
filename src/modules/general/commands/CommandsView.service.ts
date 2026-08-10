import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { ActionRow } from "@/core/discord/ui/ActionRow";
import { Embed } from "@/core/discord/ui/Embed";
import { SelectMenu } from "@/core/discord/ui/SelectMenu";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { ECommandCategory } from "@domain/core/Command";
import { discordEmoteBot, discordEmoteModes } from "@domain/discord/configs/Emotes.config";
import { CommandsViewDto } from "@domain/general/views/Commands.view";
import { GameMode } from "@generated/adapter/types";

interface ICommandCategoryConfig {
    label: string;
    description: string;
    emoji: string;
}

export class CommandsViewService extends AbstractViewService<CommandsViewDto> {
    protected readonly ttl: number = 120;

    private readonly categories: Readonly<Record<ECommandCategory, ICommandCategoryConfig>> = {
        [ECommandCategory.General]: {
            label: "general",
            description: "general bot commands",
            emoji: discordEmoteBot,
        },

        [ECommandCategory.Osu]: {
            label: "osu!",
            description: "general osu! commands",
            emoji: discordEmoteModes[GameMode.Standard],
        },

        [ECommandCategory.Taiko]: {
            label: "osu!taiko",
            description: "osu!taiko specific commands",
            emoji: discordEmoteModes[GameMode.Taiko],
        },

        [ECommandCategory.Catch]: {
            label: "osu!catch",
            description: "osu!catch specific commands",
            emoji: discordEmoteModes[GameMode.Catch],
        },

        [ECommandCategory.Mania]: {
            label: "osu!mania",
            description: "osu!mania specific commands",
            emoji: discordEmoteModes[GameMode.Mania],
        },
    };

    private readonly categoryOrder: ReadonlyArray<ECommandCategory> = [
        ECommandCategory.General,
        ECommandCategory.Osu,
        ECommandCategory.Taiko,
        ECommandCategory.Catch,
        ECommandCategory.Mania,
    ];

    public build(sessionID: string, data: CommandsViewDto): TMessagePayload {
        const router = this.discord.commandRouter;
        const category = this.categories[data.category];

        const commands = router.getPrefixCommandEntries(data.category).sort((a, b) => a.name.localeCompare(b.name));

        const description =
            commands.length > 0
                ? commands
                      .map(({ name, command }) => {
                          const options = router.getCommandOptions(command);

                          return `\`${name}\`: ${this.normalizeDescription(options?.description)}`;
                      })
                      .join("\n")
                : "No prefix commands are currently available in this category.";

        const embed = new Embed()
            .setAuthor({
                name:
                    data.category === ECommandCategory.General
                        ? "Prefix commands • Type / to browse slash commands"
                        : `${category.label} prefix commands`,
            })
            .setDescription(description)
            .setFooter({
                text: "Select a category below to view its commands.",
            });

        const menu = new SelectMenu(`commands_category:${sessionID}`).setCurrent(data.category);

        for (const categoryID of this.categoryOrder) {
            const config = this.categories[categoryID];

            menu.addChoice(config.label, categoryID, config.description, config.emoji);
        }

        return {
            embeds: [embed],
            components: [new ActionRow().add(menu)],
        };
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
