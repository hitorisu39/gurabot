import { Import } from "@/core/decorators";
import { Embed } from "@/core/discord/ui/Embed";
import { DescriptionBuilder } from "@/core/discord/ui/DescriptionBuilder";
import { AbstractService } from "@/core/framework/AbstractService";
import { discordMaxVisualLineLength } from "@domain/discord/configs/Discord.config";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import {
    scoreDetailedPageSize,
    scoreStatsCompactDelimiter,
    scoreStatsDelimiter,
} from "@domain/osu/configs/Score.config";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { ScoreFormatter } from "@domain/osu/formatters/Score.formatter";
import { TopIfScore } from "@domain/osu/TopIf.dto";
import { ScoreUtils } from "@domain/osu/utils/ScoreUtils";
import { TopIfViewDto } from "@domain/osu/views/TopIf.view";
import { GameMode } from "@generated/adapter/types";
import { ProfileViewService } from "../profile/ProfileView.service";

export class TopIfScoreView extends AbstractService {
    @Import() declare private readonly profileViewService: ProfileViewService;

    public getPageSize(): number {
        return scoreDetailedPageSize;
    }

    public render(data: TopIfViewDto, pageScores: Array<TopIfScore>): Embed {
        const embed = this.profileViewService.createBaseEmbed(data.profile, data.timestamp, false);

        const description = new DescriptionBuilder();
        const isMania = data.profile.mode === GameMode.Mania;

        for (const score of pageScores) {
            if (!ScoreUtils.isFullyPopulated(score)) {
                continue;
            }

            const projection = score.topIf;
            const index = projection.projectedIndex;

            const stars = MapFormatter.stars(score.fullDifficulty.starRating);
            const mods = ScoreFormatter.mods(score.mods);

            const prefixLength = `${index}. `.length;
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
                `**${index}\\.** ` +
                `**[${header}](${MapFormatter.link(score.beatmap.id)})` +
                `${modsDisplay}** [${stars}]`;

            const scoreNum = DiscordFormatter.number(score.legacyTotalScore || score.totalScore);
            const scoreDisplay = isMania ? `**${scoreNum}**` : scoreNum;

            const statistics = ScoreFormatter.statistics(
                score.statistics,
                data.profile.mode,
                scoreStatsCompactDelimiter,
            );

            const ppChange =
                `${ScoreFormatter.pp(projection.originalPP, undefined, false)}` +
                ` ➞ ` +
                `${ScoreFormatter.pp(score.calculated.attributes.total, score.calculatedFC?.attributes.total)}`;

            const statsFirstRow = [
                `${ScoreFormatter.grade(score.grade, score.passed, score.id)} ${ScoreFormatter.accuracy(
                    score.accuracy,
                )}`,
                ppChange,
                scoreDisplay,
            ]
                .filter(Boolean)
                .join(scoreStatsDelimiter);

            const statsSecondRow = [
                isMania ? null : ScoreFormatter.combo(score.maxCombo, score.fullDifficulty.maxCombo, true),
                `\`${statistics}\``,
                DateFormatter.discord(score.endedAt, "R"),
            ]
                .filter(Boolean)
                .join(scoreStatsDelimiter);

            description.add(top).add(statsFirstRow).add(statsSecondRow);
        }

        const delta = data.projectedTotalPP - data.originalTotalPP;
        const deltaRounded = Math.round(delta);

        const title =
            `Total pp: ${ProfileFormatter.pp(data.originalTotalPP)}` +
            ` ➞ ${ProfileFormatter.pp(data.projectedTotalPP)}` +
            ` (${DiscordFormatter.delta(deltaRounded)}pp)`;

        return embed
            .setTitle(title)
            .setDescription(description.buildOr("No scores."))
            .setFooter({
                text: "Hypothetical mod changes",
                iconURL: ProfileFormatter.modeIcon(data.profile.mode),
            });
    }
}
