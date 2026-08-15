import { AbstractScoreView } from "./AbstractScoreView";
import { Embed } from "@/core/discord/ui/Embed";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { ScoresViewDto } from "@domain/osu/views/Scores.view";
import { AdapterProvider, GameMode, Score } from "@generated/adapter/types";
import { DescriptionBuilder } from "@/core/discord/ui/DescriptionBuilder";
import { ScoreFormatter } from "@domain/osu/formatters/Score.formatter";
import { discordMaxVisualLineLength } from "@domain/discord/configs/Discord.config";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import {
    scoreCompactPageSize,
    scoreDetailedPageSize,
    scoreStatsCompactDelimiter,
    scoreStatsDelimiter,
} from "@domain/osu/configs/Score.config";
import { BeatmapAttributesCalculator } from "@domain/osu/utils/BeatmapAttributesCalculator";
import { EScoreListSize } from "@domain/osu/enums/Score.enum";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { ScoreUtils } from "@domain/osu/utils/ScoreUtils";
import { ProviderMeta } from "@generated/adapter";

export class ListScoreView extends AbstractScoreView {
    public getPageSize(size: EScoreListSize, activeAttributes?: Array<string>): number {
        const detailed = size === EScoreListSize.Detailed;
        if (detailed) return scoreDetailedPageSize;

        const basePageSize = scoreCompactPageSize;
        const hasActiveAttributes = activeAttributes && activeAttributes.length > 0;

        return hasActiveAttributes ? Math.ceil(basePageSize / 2) : basePageSize;
    }

    public render(data: ScoresViewDto, pageScores: Array<Score>): Embed {
        const detailed = data.pageSize === EScoreListSize.Detailed;
        const embed = this.profileViewService.createBaseEmbed(data.profile, data.timestamp, false);

        // if (!pageScores.length) return embed.setDescription("No scores.");

        const description = new DescriptionBuilder();
        const isMania = data.profile.mode === GameMode.Mania;

        for (const score of pageScores.values()) {
            if (!score || !ScoreUtils.isFullyPopulated(score)) continue;

            const index = score.index;
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
            const top = `**${index}\\.** **[${header}](${MapFormatter.link(score.beatmap.id)})${modsDisplay}** [${stars}]`;

            const scoreNum = DiscordFormatter.number(score.legacyTotalScore || score.totalScore);
            const scoreDisplay = isMania ? `**${scoreNum}**` : scoreNum;

            description.add(top);

            if (detailed) {
                const statistics = ScoreFormatter.statistics(
                    score.statistics,
                    data.profile.mode,
                    scoreStatsCompactDelimiter,
                );

                const statsFirstRow = [
                    `${ScoreFormatter.grade(score.grade, score.passed, score.id)} ${ScoreFormatter.accuracy(score.accuracy)}`,
                    ScoreFormatter.pp(
                        score.pp ?? score.calculated.attributes.total,
                        score.calculatedFC?.attributes.total,
                    ),
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

                description.add(statsFirstRow).add(statsSecondRow);
            } else {
                const stats = [
                    `${ScoreFormatter.grade(score.grade, score.passed, score.id)} ${ScoreFormatter.accuracy(score.accuracy)}`,
                    ScoreFormatter.pp(
                        score.pp ?? score.calculated.attributes.total,
                        score.calculatedFC?.attributes.total,
                    ),
                    isMania ? scoreDisplay : ScoreFormatter.combo(score.maxCombo, score.fullDifficulty.maxCombo),
                    ScoreFormatter.miss(score.statistics.miss),
                    DateFormatter.discord(score.endedAt, "R"),
                ]
                    .filter(Boolean)
                    .join(scoreStatsDelimiter);

                description.add(stats);
            }

            // Append filtered map attributes
            if (data.activeAttributes && data.activeAttributes.length > 0) {
                const attrs = BeatmapAttributesCalculator.calculate(score.beatmap, score.mods);
                const liveBpm = BeatmapAttributesCalculator.bpm(score.beatmap.bpm, attrs.clockRate);
                const liveLength = BeatmapAttributesCalculator.length(score.beatmap.totalLength, attrs.clockRate);

                const attrStrings: string[] = [];
                for (const attr of data.activeAttributes) {
                    switch (attr) {
                        case "CS":
                            attrStrings.push(`CS: ${DiscordFormatter.fixed(attrs.cs)}`);
                            break;
                        case "AR":
                            attrStrings.push(`AR: ${DiscordFormatter.fixed(attrs.ar)}`);
                            break;
                        case "OD":
                            attrStrings.push(`OD: ${DiscordFormatter.fixed(attrs.od)}`);
                            break;
                        case "HP":
                            attrStrings.push(`HP: ${DiscordFormatter.fixed(attrs.hp)}`);
                            break;
                        case "BPM":
                            attrStrings.push(`BPM: ${DiscordFormatter.fixed(liveBpm)}`);
                            break;
                        case "Length":
                            attrStrings.push(`Length: ${MapFormatter.length(liveLength)}`);
                            break;
                        case "RankDate": {
                            const rankedDate = score.beatmapset.rankedDate;
                            if (!rankedDate) {
                                attrStrings.push("Ranked: Unranked");
                                break;
                            }

                            attrStrings.push(`${score.beatmapset.status}: ${DateFormatter.shortDate(rankedDate)}`);
                            break;
                        }
                    }
                }

                if (attrStrings.length > 0) {
                    description.add(`\`${attrStrings.join("` ~ `")}\``);
                }
            }
        }

        const footer =
            data.profile.provider === AdapterProvider.Bancho
                ? "Tip: click the grade to view the score"
                : ProviderMeta[data.profile.provider].name;

        return embed
            .setFooter({
                text: footer,
                iconURL: ProfileFormatter.modeIcon(data.profile.mode),
            })
            .setDescription(description.buildOr("No scores."));
    }
}
