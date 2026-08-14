import { Category, Examples, Help, Import, InjectMatch, IsInteger, Option, Required } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { OsuService } from "@/modules/osu/Osu.service";
import { OsuTrackService } from "@/modules/osutrack/OsuTrack.service";
import { OsuTrackTrendService } from "@/modules/osutrack/OsuTrackTrend.service";
import { OsuTrackLadderService } from "@/modules/osutrack/OsuTrackLadder.service";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { CommandMatcher, CommandOption, ECommandCategory } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { AdapterProvider } from "@generated/adapter/types";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { OsuTrackLadderUtils } from "@domain/osutrack/utils/OsuTrackLadderUtils";
import { OsuTrackFormatter } from "@domain/osutrack/formatters/OsuTrack.formatter";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";

@Help(`
    Estimates how long it may take a player to reach a specified global rank.
    The player's recent PP progression is estimated from osu!track history and
    simulated through osu!track's current ladder decay and PP density model.
`)
@Examples("osutrackreachrank 10000", "osutrackreachrank 1000 mrekk")
@Category(ECommandCategory.Osu)
export abstract class AbstractOsuTrackReachRankCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly osuTrackService: OsuTrackService;
    @Import() declare private readonly osuTrackTrendService: OsuTrackTrendService;
    @Import() declare private readonly osuTrackLadderService: OsuTrackLadderService;
    @Import() declare private readonly profileViewService: ProfileViewService;

    private readonly maxPredictionDays = 365.25 * 5;

    @Option("rank", "Global rank milestone to estimate")
    @IsInteger(1, 100_000_000)
    @InjectMatch(CommandMatcher.integer)
    @Required()
    declare private readonly rank: CommandOption<number>;

    public async execute(ctx: CommandContext): Promise<void> {
        const targetRank = this.rank.unwrap();
        const target = await this.resolveTarget(ctx);

        if (target.server !== AdapterProvider.Bancho) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                "osu!track reach estimates are only available for Bancho users.",
            );
        }

        const timestamp = Date.now();
        const profile = await this.osuService.user(target.query, target.mode, target.server);
        const currentRank = profile.statistics.globalRank;

        if (currentRank < 1) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                `${profile.username} does not have a global rank in this mode.`,
            );
        }

        const embed = this.profileViewService.createBaseEmbed(profile, timestamp, false);

        embed.setFooter({
            text: `${ProfileFormatter.mode(profile.mode)} · ` + "Estimated from osu!track history data",
            iconURL: ProfileFormatter.modeIcon(profile.mode),
        });

        if (currentRank <= targetRank) {
            embed
                .setDescription(
                    `${profile.username} has already reached or surpassed ` +
                        `**${ProfileFormatter.rank(targetRank)}**.`,
                )
                .addFields(
                    {
                        name: "Current rank",
                        value: ProfileFormatter.rank(currentRank),
                        inline: true,
                    },
                    {
                        name: "Target rank",
                        value: ProfileFormatter.rank(targetRank),
                        inline: true,
                    },
                );

            await ctx.respond({
                embeds: [embed],
            });

            return;
        }

        const [history, config] = await Promise.all([
            this.osuTrackService.history(profile.id, target.mode, target.server),
            this.osuTrackLadderService.simulationConfig(target.mode, target.server),
        ]);

        const trend = this.osuTrackTrendService.calculatePp(history);

        const days = OsuTrackLadderUtils.calculateReachRankDays(
            currentRank,
            targetRank,
            trend.ppPerDay,
            config.rankToDecay,
            config.rankToDensity,
            this.maxPredictionDays,
        );

        const currentDecay = OsuTrackLadderUtils.interpolate(currentRank, config.rankToDecay);
        const currentDensity = OsuTrackLadderUtils.interpolate(currentRank, config.rankToDensity);
        const maintenancePpPerDay = currentDensity > 0 ? currentDecay / currentDensity : undefined;

        const rankGain = currentRank - targetRank;

        if (days === null) {
            const fields = [
                {
                    name: "Current rank",
                    value: ProfileFormatter.rank(currentRank),
                    inline: true,
                },
                {
                    name: "Target rank",
                    value: ProfileFormatter.rank(targetRank),
                    inline: true,
                },
                {
                    name: "Ranks to gain",
                    value: DiscordFormatter.number(rankGain),
                    inline: true,
                },
                {
                    name: "Recent pace",
                    value: OsuTrackFormatter.ppRate(trend.ppPerMonth, "month"),
                    inline: true,
                },
            ];

            if (maintenancePpPerDay !== undefined && Number.isFinite(maintenancePpPerDay)) {
                fields.push({
                    name: "Pace to hold rank",
                    value: OsuTrackFormatter.ppRate(maintenancePpPerDay, "day"),
                    inline: true,
                });
            }

            fields.push({
                name: "Confidence",
                value: trend.confidence,
                inline: true,
            });

            embed
                .setDescription(
                    `Reaching **${ProfileFormatter.rank(targetRank)}** appears ` +
                        `**unlikely at ${profile.username}'s current pace** within the next 5 years.`,
                )
                .addFields(fields);

            await ctx.respond({
                embeds: [embed],
            });

            return;
        }

        embed
            .setDescription(
                `Based on ${profile.username}'s recent PP progression and the current osu!track ladder model, ` +
                    `they are estimated to reach **${ProfileFormatter.rank(targetRank)}** in approximately ` +
                    `**${DateFormatter.estimateDays(days)}**.`,
            )
            .addFields(
                {
                    name: "Current rank",
                    value: ProfileFormatter.rank(currentRank),
                    inline: true,
                },
                {
                    name: "Target rank",
                    value: ProfileFormatter.rank(targetRank),
                    inline: true,
                },
                {
                    name: "Ranks to gain",
                    value: DiscordFormatter.number(rankGain),
                    inline: true,
                },
                {
                    name: "Recent pace",
                    value: OsuTrackFormatter.ppRate(trend.ppPerMonth, "month"),
                    inline: true,
                },
                {
                    name: "Confidence",
                    value: trend.confidence,
                    inline: true,
                },
            );

        await ctx.respond({
            embeds: [embed],
        });
    }
}
