import { AbstractService } from "@/core/framework/AbstractService";
import { Embed } from "@/core/discord/ui/Embed";
import { TMessagePayload } from "@/core/discord/context/CommandContext";

import { GuildDto } from "@domain/guild/Guild.dto";
import { UserDto } from "@domain/user/User.dto";

import { EScoreListSize } from "@domain/osu/enums/Score.enum";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";

import { AdapterProvider, GameMode } from "@generated/adapter/types";
import { ProviderMeta } from "@generated/adapter";

export class ConfigViewService extends AbstractService {
    public guild(data: GuildDto | null, updated: boolean = false): TMessagePayload {
        const prefix = data?.prefix ?? this.config.app.prefix;

        const server = data?.server ?? AdapterProvider.Bancho;
        const serverDisplay = ProviderMeta[server].name;

        const mode = data?.mode ?? GameMode.Standard;
        const modeDisplay = ProfileFormatter.mode(mode, true);

        const scoreListSize = data?.scoreListSize ?? EScoreListSize.Detailed;
        const spoilMedals = data?.spoilMedals ?? true;

        const embed = new Embed()
            .setTitle("Server configuration")
            .addFields(
                {
                    name: "Prefix",
                    value: `\`${prefix}\``,
                    inline: true,
                },
                {
                    name: "Server",
                    value: `\`${serverDisplay}\``,
                    inline: true,
                },
                {
                    name: "Mode",
                    value: `\`${modeDisplay}\``,
                    inline: true,
                },
                {
                    name: "Score list",
                    value: this.choiceList(scoreListSize, [
                        {
                            value: EScoreListSize.Detailed,
                            label: "Detailed",
                        },
                        {
                            value: EScoreListSize.Compact,
                            label: "Compact",
                        },
                    ]),
                    inline: true,
                },
                {
                    name: "Medal solutions",
                    value: this.choiceList(spoilMedals, [
                        {
                            value: true,
                            label: "Spoilered",
                        },
                        {
                            value: false,
                            label: "Visible",
                        },
                    ]),
                    inline: true,
                },
                {
                    name: "\u200B",
                    value: "\u200B",
                    inline: true,
                },
            )
            .setFooter({
                text: "Configure with /config guild",
            });

        if (updated) {
            embed.setDescription("✅ **Configuration updated**");
        }

        return {
            embeds: [embed],
        };
    }

    public user(data: UserDto, updated: boolean = false): TMessagePayload {
        const serverDisplay = data.server ? ProviderMeta[data.server].name : "Inherited";
        const modeDisplay = data.mode ? ProfileFormatter.mode(data.mode, true) : "Inherited";

        const embed = new Embed()
            .setTitle("User configuration")
            .addFields(
                {
                    name: "Server",
                    value: `\`${serverDisplay}\``,
                    inline: true,
                },
                {
                    name: "Mode",
                    value: `\`${modeDisplay}\``,
                    inline: true,
                },
                {
                    name: "\u200B",
                    value: "\u200B",
                    inline: true,
                },
                {
                    name: "Score list",
                    value: data.scoreListSize
                        ? this.choiceList(data.scoreListSize, [
                              {
                                  value: EScoreListSize.Detailed,
                                  label: "Detailed",
                              },
                              {
                                  value: EScoreListSize.Compact,
                                  label: "Compact",
                              },
                          ])
                        : "`Inherited`",
                    inline: false,
                },
            )
            .setFooter({
                text: "Configure with /config user",
            });

        if (updated) {
            embed.setDescription("✅ **Configuration updated**");
        }

        return {
            embeds: [embed],
        };
    }

    private choiceList<T>(
        selected: T,
        choices: ReadonlyArray<{
            value: T;
            label: string;
        }>,
    ): string {
        return choices
            .map(({ value, label }) => {
                const marker = value === selected ? "›" : " ";
                return `\`${marker} ${label}\``;
            })
            .join("\n");
    }
}
