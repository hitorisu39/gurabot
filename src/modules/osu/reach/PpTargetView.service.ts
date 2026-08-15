import { Import } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { ProfileViewService } from "../profile/ProfileView.service";
import { PpTargetViewDataDto } from "@domain/osu/views/PpTarget.view";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { PpTargetRouteDto } from "@domain/osu/Reach.dto";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { ERankPpResolutionSource } from "@domain/osu/enums/Reach.enum";

export class PpTargetViewService extends AbstractService {
    @Import() declare private readonly profileViewService: ProfileViewService;

    public build(data: PpTargetViewDataDto): TMessagePayload {
        const embed = this.profileViewService.createBaseEmbed(data.profile, null, false);

        const username = data.profile.username;
        const resolution = data.rankResolution;
        const targetUser = data.targetUser;

        const target = resolution
            ? ProfileFormatter.rank(resolution.rank, resolution.countryCode)
            : targetUser
              ? targetUser.username
              : ProfileFormatter.pp(data.targetPP);

        const ppDifference = data.targetPP - data.profile.statistics.pp;

        let description = "";

        if (resolution) {
            const rank = ProfileFormatter.rank(resolution.rank, resolution.countryCode);

            if (resolution.source === ERankPpResolutionSource.Ranking && resolution.holder) {
                description +=
                    `Rank ${rank} is currently held by \`${resolution.holder.username}\` ` +
                    `with **${ProfileFormatter.pp(resolution.pp)}**, so `;
            } else {
                description += `Rank ${rank} is currently approx. ` + `**${ProfileFormatter.pp(resolution.pp)}**, so `;
            }
        } else if (targetUser) {
            description +=
                `\`${targetUser.username}\` currently has ` +
                `**${ProfileFormatter.pp(targetUser.statistics.pp)}**, so `;
        }

        description +=
            `${username} needs **+${ProfileFormatter.pp(ppDifference)}**. ` +
            `They could reach that with **${this.route(data.calculation.primary)}**`;

        if (data.calculation.alternative) {
            description += ` or ${this.route(data.calculation.alternative)}`;
        }

        description += ".";

        embed
            .setTitle(`How can ${username} reach ${target}?`)
            .setDescription(description)
            .setFooter({
                text: ProfileFormatter.mode(data.profile.mode),
                iconURL: ProfileFormatter.modeIcon(data.profile.mode),
            });

        return {
            embeds: [embed],
        };
    }

    private route(route: PpTargetRouteDto): string {
        const groups: Array<{
            pp: number;
            count: number;
        }> = [];

        for (const pp of route.scores) {
            const last = groups.at(-1);

            if (last && Math.abs(last.pp - pp) < 0.005) {
                last.count++;
                continue;
            }

            groups.push({
                pp,
                count: 1,
            });
        }

        return groups
            .map((group) => {
                const quantity = DiscordFormatter.quantity(group.count, "score");

                return group.count === 1
                    ? `${quantity} worth ${ProfileFormatter.pp(group.pp)}`
                    : `${quantity} worth ${ProfileFormatter.pp(group.pp)} each`;
            })
            .join(" and ");
    }
}
