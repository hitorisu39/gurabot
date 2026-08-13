import {
    Category,
    Examples,
    Help,
    Import,
    InjectMatch,
    IsInteger,
    IsNumber,
    Option,
    Required,
} from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { OsuService } from "@/modules/osu/Osu.service";
import { OsuTrackLadderService } from "@/modules/osutrack/OsuTrackLadder.service";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { CommandMatcher, CommandOption, ECommandCategory } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { AdapterProvider } from "@generated/adapter/types";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { OsuTrackLadderUtils } from "@domain/osutrack/utils/OsuTrackLadderUtils";

@Help(`
    Estimates where a player's global rank would decay to after a specified
    number of days without gaining pp.

    The estimate uses osu!track's historical ladder decay model.
`)
@Examples("osutrackdecaydays 30", "osutrackdecaydays 90 mrekk")
@Category(ECommandCategory.Osu)
export abstract class AbstractOsuTrackDecayDaysCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly osuTrackLadderService: OsuTrackLadderService;
    @Import() declare private readonly profileViewService: ProfileViewService;

    @Option("days", "Number of days without gaining PP")
    @IsInteger(1, 36500)
    @InjectMatch(CommandMatcher.positiveInteger)
    @Required()
    declare private readonly days: CommandOption<number>;

    public async execute(ctx: CommandContext): Promise<void> {
        const days = this.days.unwrap();
        const target = await this.resolveTarget(ctx);

        if (target.server !== AdapterProvider.Bancho) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                "osu!track rank decay is only available for Bancho users.",
            );
        }

        const timestamp = Date.now();
        const profile = await this.osuService.user(target.query, target.mode, target.server);
        const currentRank = Number(profile.statistics.globalRank);

        if (!Number.isFinite(currentRank) || currentRank < 1) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                `${profile.username} does not have a global rank in this mode.`,
            );
        }

        const config = await this.osuTrackLadderService.simulationConfig(target.mode, target.server);

        const projectedRank = OsuTrackLadderUtils.projectRankDecay(currentRank, days, config.rankToDecay);
        const rankLoss = Math.max(0, projectedRank - currentRank);
        const currentDecay = OsuTrackLadderUtils.interpolate(currentRank, config.rankToDecay);

        const embed = this.profileViewService.createBaseEmbed(profile, timestamp, false);
        embed
            .setTitle(`${profile.username}'s rank decay`)
            .setDescription(
                `Without gaining pp for **${DiscordFormatter.number(days)} ${days === 1 ? "day" : "days"}**, ` +
                    `${profile.username}'s global rank is estimated to decay to ` +
                    `**${ProfileFormatter.rank(projectedRank)}**.\n` +
                    `That's a loss of approximately **${DiscordFormatter.number(rankLoss)} ranks**. ` +
                    `Their current modeled decay rate is **~${this.formatDecay(currentDecay)} ranks/day**.`,
            )
            .setFooter({
                text: ProfileFormatter.mode(profile.mode),
                iconURL: ProfileFormatter.modeIcon(profile.mode),
            });

        await ctx.respond({
            embeds: [embed],
        });
    }

    private formatDecay(value: number): string {
        if (value >= 100) {
            return DiscordFormatter.number(Math.round(value));
        }

        if (value >= 10) {
            return value.toFixed(1);
        }

        if (value >= 1) {
            return value.toFixed(2);
        }

        if (value >= 0.01) {
            return value.toFixed(3);
        }

        return value.toFixed(4);
    }
}
