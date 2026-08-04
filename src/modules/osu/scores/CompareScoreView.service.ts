import { AbstractScoreView } from "./AbstractScoreView";
import { Embed } from "@/core/discord/ui/Embed";
import { ScoresViewDto } from "@domain/osu/views/Scores.view";
import { Score } from "@generated/adapter/types";
import { ScoreUtils } from "@domain/osu/utils/ScoreUtils";
import { GameMode } from "../../../../adapter/models/common";
import { DescriptionBuilder } from "@/core/discord/ui/DescriptionBuilder";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { ScoreFormatter } from "@domain/osu/formatters/Score.formatter";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { BeatmapAttributesCalculator } from "@domain/osu/utils/BeatmapAttributesCalculator";
import { scoreStatsDelimiter } from "@domain/osu/configs/Score.config";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";

export class CompareScoreView extends AbstractScoreView {
    public getPageSize(): number {
        return 10;
    }

    public render(data: ScoresViewDto, pageScores: Array<Score>): Embed {
        const embed = this.profileViewService.createBaseEmbed(data.profile, data.timestamp, false);

        if (!pageScores.length) return embed.setDescription("No scores.");

        const description = new DescriptionBuilder();
        const isMania = data.profile.mode === GameMode.Mania;

        const firstScore = pageScores[0];
        const isFirstPage = data.page === 1;

        if (isFirstPage && firstScore && ScoreUtils.isFullyPopulated(firstScore)) {
            const placement = ScoreFormatter.placement(firstScore);
            if (placement) description.add(placement);

            const stars = MapFormatter.stars(firstScore.fullDifficulty.starRating);
            const mods = ScoreFormatter.mods(firstScore.mods);

            const scoreNum = DiscordFormatter.number(firstScore.legacyTotalScore || firstScore.totalScore);
            const scoreDisplay = isMania ? `**${scoreNum}**` : scoreNum;

            const grade = ScoreFormatter.grade(firstScore.grade, firstScore.passed, firstScore.id);

            const gradeAndMods = mods ? `**${grade} ${mods}**` : `**${grade}**`;
            const accuracy = ScoreFormatter.accuracy(firstScore.accuracy);

            const statsFirstRow = `${gradeAndMods} ${DiscordFormatter.space(2)} ${accuracy} ${DiscordFormatter.space(4)} ${scoreDisplay} ${DiscordFormatter.space(4)} ${DateFormatter.discord(firstScore.endedAt, "R")}`;

            const pp = ScoreFormatter.pp(
                firstScore.pp ?? firstScore.calculated.attributes.total,
                firstScore.calculatedFC?.attributes.total,
            );

            let comboRatioString;
            if (isMania) {
                const perfect = firstScore.statistics.perfect ?? 0;
                const great = firstScore.statistics.great ?? 0;
                const ratio = great > 0 ? (perfect / great).toFixed(2) : perfect.toString();
                comboRatioString = `${firstScore.maxCombo}x / **${ratio}**`;
            } else {
                comboRatioString = ScoreFormatter.combo(firstScore.maxCombo, firstScore.fullDifficulty.maxCombo, true);
            }

            const hitsString = `${ScoreFormatter.statistics(firstScore.statistics, data.profile.mode, "/")}`;
            const statsSecondRow = [pp, comboRatioString, hitsString].filter(Boolean).join(scoreStatsDelimiter);

            const attrs = BeatmapAttributesCalculator.calculate(firstScore.beatmap, firstScore.mods);
            const liveBpm = BeatmapAttributesCalculator.bpm(firstScore.beatmap.bpm, attrs.clockRate);
            const liveLength = BeatmapAttributesCalculator.length(firstScore.beatmap.totalLength, attrs.clockRate);

            const statsThirdRow = [
                `${MapFormatter.length(liveLength)}`,
                `\`CS: ${DiscordFormatter.fixed(attrs.cs)} AR: ${DiscordFormatter.fixed(attrs.ar)} OD: ${DiscordFormatter.fixed(attrs.od)} HP: ${DiscordFormatter.fixed(attrs.hp)}\``,
                `♫ ${DiscordFormatter.fixed(liveBpm)}`,
            ]
                .filter(Boolean)
                .join(scoreStatsDelimiter);

            description.add(statsFirstRow).add(statsSecondRow).add(statsThirdRow);

            embed
                .setFooter({
                    text: `${firstScore.beatmap.status} by ${firstScore.beatmapset.creator}`,
                    iconURL: ProfileFormatter.modeIcon(data.profile.mode),
                })
                .setThumbnail(firstScore.beatmapset.covers.listDouble)
                .setTitle(
                    `${firstScore.beatmapset.artist} - ${firstScore.beatmapset.title} [${firstScore.beatmap.version}] [${stars}]`,
                )
                .setURL(MapFormatter.link(firstScore.beatmap.id));
        }

        const remainingScores = isFirstPage ? pageScores.slice(1) : pageScores;

        if (remainingScores.length > 0) {
            if (isFirstPage) description.add("");

            for (const score of remainingScores) {
                if (!score || !ScoreUtils.isFullyPopulated(score)) continue;

                const stars = MapFormatter.stars(score.fullDifficulty.starRating);
                const mods = ScoreFormatter.mods(score.mods);

                const grade = ScoreFormatter.grade(score.grade, score.passed, score.id);

                const gradeAndMods = mods ? `**${grade} ${mods}**` : `**${grade}**`;
                const accuracy = ScoreFormatter.accuracy(score.accuracy);

                const combo = ScoreFormatter.combo(score.maxCombo);
                const miss = ScoreFormatter.miss(score.statistics.miss);
                const comboAndMiss = miss ? `${combo} ${DiscordFormatter.space(2)} ${miss}` : combo;
                const age = DateFormatter.age(score.endedAt);

                const pp = ScoreFormatter.pp(
                    score.pp ?? score.calculated.attributes.total,
                    score.calculatedFC?.attributes.total,
                );

                const placement = ScoreFormatter.placement(score, true);

                const parts = [`${gradeAndMods} ${accuracy}`, `${pp} (${stars})`, comboAndMiss, age, placement];

                description.add(parts.filter(Boolean).join(` ${DiscordFormatter.space(2)} `));
            }
        }

        return embed.setDescription(description.buildOr("No scores."));
    }
}
