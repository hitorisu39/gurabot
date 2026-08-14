import { Category, Examples, Help, Import, InjectMatch, IsNumber, Option, Required } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { OsuService } from "@/modules/osu/Osu.service";
import { OsuTrackService } from "@/modules/osutrack/OsuTrack.service";
import { OsuTrackTrendService } from "@/modules/osutrack/OsuTrackTrend.service";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { CommandMatcher, CommandOption, ECommandCategory } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { AdapterProvider } from "@generated/adapter/types";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { OsuTrackFormatter } from "@domain/osutrack/formatters/OsuTrack.formatter";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";

@Help(`
    Estimates how long it may take a player to reach a specified PP value
    based on their recent osu!track progression.
    Recent history is weighted more heavily than older history.
`)
@Examples("osutrackreachpp 10000", "osutrackreachpp 15000 mrekk")
@Category(ECommandCategory.Osu)
export abstract class AbstractOsuTrackReachPpCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly osuTrackService: OsuTrackService;
    @Import() declare private readonly osuTrackTrendService: OsuTrackTrendService;
    @Import() declare private readonly profileViewService: ProfileViewService;

    private readonly maxPredictionDays = 365.25 * 5;

    @Option("pp", "PP milestone to estimate")
    @IsNumber(1, 100_000)
    @InjectMatch(CommandMatcher.number)
    @Required()
    declare private readonly pp: CommandOption<number>;

    public async execute(ctx: CommandContext): Promise<void> {
        const targetPP = this.pp.unwrap();
        const target = await this.resolveTarget(ctx);

        if (target.server !== AdapterProvider.Bancho) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                "osu!track reach estimates are only available for Bancho users.",
            );
        }

        const timestamp = Date.now();
        const profile = await this.osuService.user(target.query, target.mode, target.server);
        const currentPP = Number(profile.statistics.pp);

        if (!Number.isFinite(currentPP)) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                `${profile.username} does not have a valid PP value in this mode.`,
            );
        }

        const embed = this.profileViewService.createBaseEmbed(profile, timestamp, false);

        embed.setFooter({
            text: `${ProfileFormatter.mode(profile.mode)} · ` + "Estimated from recent osu!track history",
            iconURL: ProfileFormatter.modeIcon(profile.mode),
        });

        if (currentPP >= targetPP) {
            embed
                .setDescription(`${profile.username} has already reached **${OsuTrackFormatter.pp(targetPP)}**.`)
                .addFields(
                    {
                        name: "Current PP",
                        value: OsuTrackFormatter.pp(currentPP),
                        inline: true,
                    },
                    {
                        name: "Target PP",
                        value: OsuTrackFormatter.pp(targetPP),
                        inline: true,
                    },
                );

            await ctx.respond({
                embeds: [embed],
            });

            return;
        }

        const history = await this.osuTrackService.history(profile.id, target.mode, target.server);
        const trend = this.osuTrackTrendService.calculatePp(history);
        const ppRemaining = targetPP - currentPP;

        if (trend.ppPerDay <= 0) {
            embed
                .setDescription(
                    `Reaching **${OsuTrackFormatter.pp(targetPP)}** appears ` +
                        `**unlikely at ${profile.username}'s current pace**.`,
                )
                .addFields(
                    {
                        name: "Current PP",
                        value: OsuTrackFormatter.pp(currentPP),
                        inline: true,
                    },
                    {
                        name: "Target PP",
                        value: OsuTrackFormatter.pp(targetPP),
                        inline: true,
                    },
                    {
                        name: "PP remaining",
                        value: OsuTrackFormatter.pp(ppRemaining),
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

            return;
        }

        const days = ppRemaining / trend.ppPerDay;

        if (days > this.maxPredictionDays) {
            embed
                .setDescription(
                    `Reaching **${OsuTrackFormatter.pp(targetPP)}** is not projected ` +
                        `within the next **5 years** at ${profile.username}'s current pace.`,
                )
                .addFields(
                    {
                        name: "Current PP",
                        value: OsuTrackFormatter.pp(currentPP),
                        inline: true,
                    },
                    {
                        name: "Target PP",
                        value: OsuTrackFormatter.pp(targetPP),
                        inline: true,
                    },
                    {
                        name: "PP remaining",
                        value: OsuTrackFormatter.pp(ppRemaining),
                        inline: true,
                    },
                    {
                        name: "Recent pace",
                        value: OsuTrackFormatter.ppRate(trend.ppPerMonth, "month"),
                        inline: true,
                    },
                    {
                        name: "Trend confidence",
                        value: trend.confidence,
                        inline: true,
                    },
                );

            await ctx.respond({
                embeds: [embed],
            });

            return;
        }

        embed
            .setDescription(
                `Based on recent osu!track progression, ${profile.username} is estimated to reach ` +
                    `**${OsuTrackFormatter.pp(targetPP)}** in approximately **${DateFormatter.estimateDays(days)}**.`,
            )
            .addFields(
                {
                    name: "Current PP",
                    value: OsuTrackFormatter.pp(currentPP),
                    inline: true,
                },
                {
                    name: "Target PP",
                    value: OsuTrackFormatter.pp(targetPP),
                    inline: true,
                },
                {
                    name: "PP remaining",
                    value: OsuTrackFormatter.pp(ppRemaining),
                    inline: true,
                },
                {
                    name: "Recent pace",
                    value: OsuTrackFormatter.ppRate(trend.ppPerMonth, "month"),
                    inline: true,
                },
                {
                    name: "Trend confidence",
                    value: trend.confidence,
                    inline: true,
                },
            );

        await ctx.respond({
            embeds: [embed],
        });
    }
}
