import { Import } from "@/core/decorators";
import { Embed } from "@/core/discord/ui/Embed";
import { DescriptionBuilder } from "@/core/discord/ui/DescriptionBuilder";
import { AbstractService } from "@/core/framework/AbstractService";
import { discordMaxVisualLineLength } from "@domain/discord/configs/Discord.config";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { scoreDetailedPageSize, scoreStatsDelimiter } from "@domain/osu/configs/Score.config";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { ScoreFormatter } from "@domain/osu/formatters/Score.formatter";
import { NoChokeScore } from "@domain/osu/NoChoke.dto";
import { ScoreUtils } from "@domain/osu/utils/ScoreUtils";
import { NoChokeViewDto } from "@domain/osu/views/NoChoke.view";
import { ProfileViewService } from "../profile/ProfileView.service";

export class NoChokeScoreView extends AbstractService {
    @Import()
    declare private readonly profileViewService: ProfileViewService;

    public getPageSize(): number {
        return scoreDetailedPageSize;
    }

    public render(data: NoChokeViewDto, pageScores: Array<NoChokeScore>): Embed {
        const embed = this.profileViewService.createBaseEmbed(data.profile, data.timestamp, false);
        const description = new DescriptionBuilder();

        for (const score of pageScores) {
            if (!ScoreUtils.isFullyPopulated(score)) {
                continue;
            }

            const projection = score.noChoke;
            const stars = MapFormatter.stars(score.fullDifficulty.starRating);
            const mods = ScoreFormatter.mods(score.mods);

            const prefixLength = `${projection.originalIndex}. `.length;
            const suffixLength = mods ? `[${stars}] ${mods}`.length : `[${stars}]`.length;
            const headerLimit = Math.max(20, discordMaxVisualLineLength - prefixLength - suffixLength);

            const header = MapFormatter.header(
                score.beatmapset.artist,
                score.beatmapset.title,
                score.beatmap.version,
                headerLimit,
            );

            const modsDisplay = mods ? ` ${mods}` : "";

            const top =
                `**${projection.originalIndex}\\.** ` +
                `**[${header}](${MapFormatter.link(score.beatmap.id)})` +
                `${modsDisplay}** [${stars}]`;

            const projectedGrade = ScoreFormatter.grade(projection.projectedGrade, true);

            const accuracyChange =
                `${ScoreFormatter.accuracy(projection.originalAccuracy)}` +
                ` ➞ ` +
                `${ScoreFormatter.accuracy(projection.projectedAccuracy)}`;

            const ppChange =
                `${ScoreFormatter.pp(projection.originalPP, undefined, false)}` + ` ➞ ` + `${ScoreFormatter.pp(projection.projectedPP)}`;

            const originalCombo = ScoreFormatter.combo(projection.originalCombo);
            const projectedCombo = ScoreFormatter.combo(projection.projectedCombo, score.fullDifficulty.maxCombo, true);
            const comboChange = `${originalCombo} ➞ ${projectedCombo}`;

            const status = this.projectionStatus(score);
            const firstRow = [`${projectedGrade} ${accuracyChange}`, ppChange].join(scoreStatsDelimiter);

            const secondRow = [comboChange, status, DateFormatter.discord(score.endedAt, "R")]
                .filter(Boolean)
                .join(scoreStatsDelimiter);

            description.add(top).add(firstRow).add(secondRow);
        }

        const delta = data.projectedTotalPP - data.originalTotalPP;

        const deltaRounded = Math.round(delta);
        const deltaSign = deltaRounded >= 0 ? "+" : "";

        const title =
            `Total pp: ${this.totalPP(data.originalTotalPP)}` +
            ` ➞ ${this.totalPP(data.projectedTotalPP)}` +
            ` (${deltaSign}${DiscordFormatter.number(deltaRounded)}pp)`;

        const limitText =
            data.maximumMisses === null ? "All missed plays" : `Plays with ${data.maximumMisses} or fewer misses`;

        return embed
            .setTitle(title)
            .setDescription(description.buildOr("No scores."))
            .setFooter({
                text: `${limitText}`,
                iconURL: ProfileFormatter.modeIcon(data.profile.mode),
            });
    }

    private projectionStatus(score: NoChokeScore): string {
        return `Removed ${ScoreFormatter.miss(score.noChoke.removedMisses, true)}`;
    }

    private totalPP(value: number): string {
        return `${DiscordFormatter.number(Math.round(value))}pp`;
    }
}
