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
    Estimates how long it would take a player's global rank to naturally
    decay to a specified rank without gaining pp.

    The estimate uses osu!track's historical ladder decay model.
`)
@Examples("osutrackdecayrank 100000", "osutrackdecayrank 50000 mrekk")
@Category(ECommandCategory.Osu)
export abstract class AbstractOsuTrackDecayRankCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly osuTrackLadderService: OsuTrackLadderService;
    @Import() declare private readonly profileViewService: ProfileViewService;

    @Option("rank", "Global rank to decay to")
    @IsInteger(1, 100_000_000)
    @InjectMatch(CommandMatcher.positiveInteger)
    @Required()
    declare private readonly rank: CommandOption<number>;

    public async execute(ctx: CommandContext): Promise<void> {
        const targetRank = this.rank.unwrap();
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

        if (targetRank <= currentRank) {
            throw new Exception(
                EApplicationError.INPUT_ERROR,
                `The target rank must be worse than ${profile.username}'s current rank of ${ProfileFormatter.rank(currentRank)}.`,
            );
        }

        const config = await this.osuTrackLadderService.simulationConfig(target.mode, target.server);
        const lastPoint = config.rankToDecay.at(-1);

        if (!lastPoint) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "osu!track returned no ladder decay data.");
        }

        const maxModeledRank = lastPoint[0];
        if (targetRank > maxModeledRank) {
            throw new Exception(
                EApplicationError.INPUT_ERROR,
                `osu!track's decay model currently only covers ranks up to ${ProfileFormatter.rank(maxModeledRank)}.`,
            );
        }

        const days = OsuTrackLadderUtils.calculateDecayDays(currentRank, targetRank, config.rankToDecay);
        if (days === null) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                `The decay model could not reach ${ProfileFormatter.rank(targetRank)} from ${ProfileFormatter.rank(currentRank)} within the supported simulation range.`,
            );
        }

        const rankLoss = targetRank - currentRank;
        const embed = this.profileViewService.createBaseEmbed(profile, timestamp);

        embed
            .setTitle(`${profile.username}'s rank decay`)
            .setDescription(
                `Without gaining pp, ${profile.username} is estimated to decay from ` +
                    `**${ProfileFormatter.rank(currentRank)}** to ` +
                    `**${ProfileFormatter.rank(targetRank)}** after approximately ` +
                    `**${this.formatDays(days)}**. ` +
                    `That's a loss of **${DiscordFormatter.number(rankLoss)} ranks**.`,
            )
            .setFooter({
                text: ProfileFormatter.mode(profile.mode),
                iconURL: ProfileFormatter.modeIcon(profile.mode),
            });

        await ctx.respond({
            embeds: [embed],
        });
    }

    private formatDays(days: number): string {
        if (days < 1) {
            const hours = Math.max(1, Math.round(days * 24));
            return `${hours} ${hours === 1 ? "hour" : "hours"}`;
        }

        const roundedDays = Math.ceil(days);
        if (roundedDays < 365) {
            return `${DiscordFormatter.number(roundedDays)} ${roundedDays === 1 ? "day" : "days"}`;
        }

        const years = roundedDays / 365.25;
        return `${DiscordFormatter.number(roundedDays)} days (~${years.toFixed(1)} years)`;
    }
}
