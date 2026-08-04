import { Import } from "@/core/decorators";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { AbstractService } from "@/core/framework/AbstractService";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { WhatIfViewDataDto } from "@domain/osu/views/WhatIf.view";

export class WhatIfViewService extends AbstractService {
    @Import()
    declare private readonly profileViewService: ProfileViewService;

    public build(data: WhatIfViewDataDto): TMessagePayload {
        const embed = this.profileViewService.createBaseEmbed(data.profile, data.timestamp, false);

        const username = data.profile.username;
        const possessive = username.endsWith("s") ? `${username}'` : `${username}'s`;

        const ppDifference = DiscordFormatter.fixed(data.ppDifference);
        const ppSign = ppDifference > 0 ? "+" : "";

        let description =
            `This would become ${possessive} top #${DiscordFormatter.number(data.placement)} performance play.\n` +
            `Their total pp would change by **${ppSign}${ppDifference}pp** ` +
            `from **${this.pp(data.currentPP)}** to **${this.pp(data.projectedPP)}**`;

        if (data.projectedRank !== undefined) {
            const rankDifference = data.currentRank - data.projectedRank;
            const rankSign = rankDifference > 0 ? "+" : "";

            description +=
                `, and their global rank would approximately change by ` +
                `**${rankSign}${rankDifference}** ` +
                `from **${ProfileFormatter.rank(data.currentRank)}** ` +
                `to **${ProfileFormatter.rank(data.projectedRank)}**`;
        }

        description += ".";

        embed
            .setTitle(`What if ${username} got a new ${this.pp(data.playPP)} play?`)
            .setDescription(description)
            .setFooter({
                text: ProfileFormatter.mode(data.profile.mode),
                iconURL: ProfileFormatter.modeIcon(data.profile.mode),
            });

        return {
            embeds: [embed],
        };
    }

    private pp(value: number): string {
        const rounded = DiscordFormatter.fixed(value);
        return `${DiscordFormatter.number(rounded)}pp`;
    }
}
