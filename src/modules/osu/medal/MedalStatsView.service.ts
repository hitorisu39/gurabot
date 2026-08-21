import { Import } from "@/core/decorators";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { AbstractService } from "@/core/framework/AbstractService";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { GraphAchievementsService } from "@/modules/osu/graph/GraphAchievements.service";
import { MedalStatsViewDto } from "@domain/osu/views/MedalStats.view";
import { OsekaiMedalDto } from "@domain/osekai/OsekaiMedal.dto";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";
import { MedalFormatter } from "@domain/osu/formatters/Medal.formatter";
import { AttachmentBuilder } from "discord.js";
import { TextFormatter } from "@domain/discord/formatters/Text.formatter";

interface IMedalAchievement {
    medal: OsekaiMedalDto;
    achievedAt: Date;
}

export class MedalStatsViewService extends AbstractService {
    @Import() declare private readonly profileViewService: ProfileViewService;
    @Import() declare private readonly graphAchievementsService: GraphAchievementsService;

    public async build(data: MedalStatsViewDto): Promise<TMessagePayload> {
        const achievements = this.achievements(data);
        const total = data.medals.length;
        const achieved = achievements.length;

        const embed = this.profileViewService.createBaseEmbed(data.profile, null, false, false);

        embed
            .setTitle("Medal statistics")
            .setDescription(
                [
                    `**${DiscordFormatter.number(achieved)} / ${DiscordFormatter.number(total)}** medals`,
                    `**${this.completion(achieved, total)}%** complete`,
                ].join(" • "),
            );

        const newest = this.newest(achievements);
        const oldest = this.oldest(achievements);
        const rarest = this.rarest(achievements);

        embed.addFields(
            {
                name: "Newest",
                value: newest ? this.achievement(newest) : "None",
                inline: true,
            },
            {
                name: "Oldest",
                value: oldest ? this.achievement(oldest) : "None",
                inline: true,
            },
            {
                name: "Rarest",
                value: rarest ? this.rarestAchievement(rarest) : "Unknown",
                inline: true,
            },
        );

        const groups = this.groups(data.medals, new Set(achievements.map((achievement) => achievement.medal.id)));
        embed.addFields({
            name: "Groups",
            value: groups,
        });

        const filename = "medal-achievements.png";
        if (!achievements.length) {
            return {
                content: `${TextFormatter.possessive(data.profile.username, true)} medal statistics:`,
                embeds: [embed],
            };
        }

        const graph = await this.graphAchievementsService.generate(
            achievements.map((achievement) => ({
                achievementID: achievement.medal.id,
                achievedAt: achievement.achievedAt,
            })),
        );

        embed.setImage(`attachment://${filename}`);
        return {
            content: `${TextFormatter.possessive(data.profile.username, true)} medal statistics:`,
            embeds: [embed],
            files: [
                new AttachmentBuilder(graph, {
                    name: filename,
                }),
            ],
        };
    }

    private achievements(data: MedalStatsViewDto): Array<IMedalAchievement> {
        const achievementByID = new Map(
            (data.profile.achievements ?? []).map((achievement) => [achievement.achievementID, achievement]),
        );

        return data.medals
            .map((medal): IMedalAchievement | null => {
                const achievement = achievementByID.get(medal.id);

                if (!achievement) {
                    return null;
                }

                return {
                    medal,
                    achievedAt: achievement.achievedAt,
                };
            })
            .filter((achievement): achievement is IMedalAchievement => achievement !== null);
    }

    private completion(achieved: number, total: number): string {
        if (!total) {
            return "0.00";
        }

        return ((achieved / total) * 100).toFixed(2);
    }

    private newest(achievements: ReadonlyArray<IMedalAchievement>): IMedalAchievement | null {
        return achievements.reduce<IMedalAchievement | null>((latest, achievement) => {
            if (!latest || achievement.achievedAt.getTime() > latest.achievedAt.getTime()) {
                return achievement;
            }

            return latest;
        }, null);
    }

    private oldest(achievements: ReadonlyArray<IMedalAchievement>): IMedalAchievement | null {
        return achievements.reduce<IMedalAchievement | null>((oldest, achievement) => {
            if (!oldest || achievement.achievedAt.getTime() < oldest.achievedAt.getTime()) {
                return achievement;
            }

            return oldest;
        }, null);
    }

    private rarest(achievements: ReadonlyArray<IMedalAchievement>): IMedalAchievement | null {
        return achievements.reduce<IMedalAchievement | null>((rarest, achievement) => {
            if (achievement.medal.frequency === null) {
                return rarest;
            }

            if (!rarest || rarest.medal.frequency === null || achievement.medal.frequency < rarest.medal.frequency) {
                return achievement;
            }

            return rarest;
        }, null);
    }

    private achievement(achievement: IMedalAchievement): string {
        return [
            DiscordFormatter.link(achievement.medal.name, achievement.medal.url()),
            DateFormatter.shortDate(achievement.achievedAt),
        ].join("\n");
    }

    private rarestAchievement(achievement: IMedalAchievement): string {
        return [
            DiscordFormatter.link(achievement.medal.name, achievement.medal.url()),
            `**${MedalFormatter.frequency(achievement.medal)}**`,
        ].join("\n");
    }

    private groups(medals: ReadonlyArray<OsekaiMedalDto>, achievedIDs: ReadonlySet<number>): string {
        const groups = new Map<
            string,
            {
                achieved: number;
                total: number;
                ordering: number;
            }
        >();

        for (const medal of medals) {
            const name = medal.grouping || "Other";

            const group = groups.get(name) ?? {
                achieved: 0,
                total: 0,
                ordering: medal.ordering,
            };

            group.total++;

            if (achievedIDs.has(medal.id)) {
                group.achieved++;
            }

            group.ordering = Math.min(group.ordering, medal.ordering);

            groups.set(name, group);
        }

        const items = Array.from(groups.entries())
            .sort(([aName, a], [bName, b]) => a.ordering - b.ordering || aName.localeCompare(bName))
            .map(([name, group]) => ({
                label: name,
                value: `${group.achieved}/${group.total}`,
            }));

        return DiscordFormatter.formatInlineGrid(items, 1, 64, " ", 25);
    }
}
