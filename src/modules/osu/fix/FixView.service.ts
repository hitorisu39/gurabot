import { ActionRow } from "@/core/discord/ui/ActionRow";
import { TMessagePayload } from "@/core/discord/context/MessagePayload";
import { Import } from "@/core/decorators";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { CalculatorService } from "@/modules/osu/calculator/Calculator.service";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { OsuDailyService } from "@/modules/osudaily/OsuDaily.service";
import { IPerformanceCalculationResponse } from "@domain/core/Calculator";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { scoreStatsCompactDelimiter, scoreStatsDelimiter } from "@domain/osu/configs/Score.config";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { ScoreFormatter } from "@domain/osu/formatters/Score.formatter";
import { ScoreGradeEvaluator } from "@domain/osu/utils/ScoreGradeEvaluator";
import { BeatmapUtils } from "@domain/osu/utils/BeatmapUtils";
import { ScoreUtils } from "@domain/osu/utils/ScoreUtils";
import { FixViewDto } from "@domain/osu/views/Fix.view";
import { AdapterProvider, GameMode } from "@generated/adapter/types";
import { HitResultResponse, ScoreState, ScoreStateKind } from "@generated/calculator/calculator";
import { ButtonStyle } from "discord.js";

interface IFixProfileProjection {
    eligible: boolean;
    placement: number | null;
    existingBestPP?: number;
    currentPP: number;
    projectedPP: number;
    ppDifference: number;
    currentRank: number;
    projectedRank?: number;
}

export class FixViewService extends AbstractViewService<FixViewDto> {
    @Import() declare private readonly calculatorService: CalculatorService;
    @Import() declare private readonly profileViewService: ProfileViewService;
    @Import() declare private readonly osuDailyService: OsuDailyService;

    protected readonly ttl = 300;

    public async build(sessionID: string, data: FixViewDto): Promise<TMessagePayload> {
        const score = data.sourceScore;
        const mode = score.mode ?? data.profile.mode;
        const maxCombo = score.fullDifficulty.maxCombo;
        const combo = Math.max(0, Math.min(data.combo ?? maxCombo, maxCombo));

        const calculated = await this.calculatorService.performance(
            score.beatmap.id,
            mode,
            {
                score: this.buildScoreState(data, mode, combo),
                precalculatedDifficulty: score.fullDifficulty,
            },
            score.mods,
        );

        if (!calculated.hitResults) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "The calculator did not return fixed hit results.");
        }

        const projection = await this.projectProfile(data, calculated.attributes.total);
        const embed = this.createEmbed(data, calculated, projection);

        return {
            content: `Fixed score for \`${data.profile.username}\`:`,
            embeds: [embed],
            components: [this.createComponents(sessionID, data, calculated.hitResults.accuracy, combo, maxCombo)],
        };
    }

    private buildScoreState(data: FixViewDto, mode: GameMode, combo: number): ScoreState {
        const statistics = data.statistics;
        const score: ScoreState = {
            kind: ScoreStateKind.SIMULATION,
            maxCombo: combo,
            countMiss: statistics.countMiss ?? 0,
        };

        if (data.accuracy !== undefined) score.accuracy = data.accuracy;
        if (statistics.count300 !== undefined) score.count300 = statistics.count300;
        if (statistics.count100 !== undefined) score.count100 = statistics.count100;
        if (statistics.count50 !== undefined) score.count50 = statistics.count50;
        if (statistics.countGeki !== undefined) score.countGeki = statistics.countGeki;
        if (statistics.countKatu !== undefined) score.countKatu = statistics.countKatu;

        if (mode === GameMode.Standard) {
            score.countSliderTailMisses = 0;
            score.countLargeTickMisses = 0;
        }

        return score;
    }

    private async projectProfile(data: FixViewDto, playPP: number): Promise<IFixProfileProjection> {
        const source = data.sourceScore;
        const currentPP = data.profile.statistics.pp;
        const currentRank = data.profile.statistics.globalRank;
        const eligible = ScoreUtils.isRanked(source) && BeatmapUtils.awardsPerformancePoints(source.beatmap.status);
        const currentWeightedPP = ScoreUtils.weightedPP(data.topScores);

        const sameMap = data.topScores.filter((score) => score.beatmapID === source.beatmapID);
        const existingBestPP = sameMap.reduce<number | undefined>((best, score) => {
            const pp = ScoreUtils.pp(score);
            return pp === undefined || (best !== undefined && best >= pp) ? best : pp;
        }, undefined);

        if (!eligible || (existingBestPP !== undefined && existingBestPP >= playPP)) {
            return {
                eligible,
                placement: null,
                existingBestPP,
                currentPP,
                projectedPP: currentPP,
                ppDifference: 0,
                currentRank,
                projectedRank: currentRank,
            };
        }

        const existingEntries = data.topScores
            .filter((score) => score.beatmapID !== source.beatmapID)
            .map((score) => ({ pp: ScoreUtils.pp(score), hypothetical: false }))
            .filter((entry): entry is { pp: number; hypothetical: false } => entry.pp !== undefined);

        const projectedEntries: Array<{ pp: number; hypothetical: boolean }> = [
            ...existingEntries,
            { pp: playPP, hypothetical: true },
        ]
            .sort((a, b) => b.pp - a.pp || Number(b.hypothetical) - Number(a.hypothetical))
            .slice(0, 100);

        const placementIndex = projectedEntries.findIndex((entry) => entry.hypothetical);
        const projectedWeightedPP = ScoreUtils.weightedPPValues(projectedEntries.map((entry) => entry.pp));
        const ppDifference = projectedWeightedPP - currentWeightedPP;
        const projectedPP = Math.max(0, currentPP + ppDifference);

        let projectedRank: number | undefined;
        if (data.profile.provider === AdapterProvider.Bancho && ppDifference > 0) {
            projectedRank = await this.osuDailyService
                .rankByPP(projectedPP, data.profile.mode, data.profile.provider)
                .catch(() => undefined);
        }

        return {
            eligible,
            placement: placementIndex === -1 ? null : placementIndex + 1,
            existingBestPP,
            currentPP,
            projectedPP,
            ppDifference,
            currentRank,
            projectedRank,
        };
    }

    private createEmbed(
        data: FixViewDto,
        calculated: IPerformanceCalculationResponse<GameMode>,
        projection: IFixProfileProjection,
    ) {
        const source = data.sourceScore;
        const mode = source.mode ?? data.profile.mode;
        const hitResults = calculated.hitResults!;
        const mods = ScoreFormatter.mods(source.mods) || "NM";
        const grade = ScoreGradeEvaluator.evaluate(mode, hitResults, source.mods);
        const stars = MapFormatter.stars(source.fullDifficulty.starRating);

        const original = [
            `${ScoreFormatter.grade(source.grade, source.passed, source.id)} ${ScoreFormatter.accuracy(source.accuracy)}`,
            ScoreFormatter.pp(ScoreUtils.pp(source) ?? source.calculated.attributes.total),
            ScoreFormatter.combo(source.maxCombo, source.fullDifficulty.maxCombo, true),
        ].join(scoreStatsDelimiter);

        const fixed = [
            `${ScoreFormatter.grade(grade, true)} ${ScoreFormatter.accuracy(hitResults.accuracy)}`,
            ScoreFormatter.pp(calculated.attributes.total),
            ScoreFormatter.combo(hitResults.maxCombo, source.fullDifficulty.maxCombo, true),
        ].join(scoreStatsDelimiter);

        const description =
            `${MapFormatter.difficultyEmote(mode, source.fullDifficulty.starRating)} ` +
            `**[${source.beatmapset.artist} - ${source.beatmapset.title} [${source.beatmap.version}]](${MapFormatter.link(source.beatmap.id)})** ` +
            `\`${stars}\` \`${mods}\``;

        return this.profileViewService
            .createBaseEmbed(data.profile, data.timestamp, false)
            .setDescription(description)
            .addFields(
                {
                    name: "Original",
                    value: `${original}\n\`${ScoreFormatter.statistics(source.statistics, mode, scoreStatsCompactDelimiter)}\``,
                },
                { name: "Fixed", value: `${fixed}\n\`${this.formatHits(mode, hitResults)}\`` },
                { name: "Profile impact", value: this.formatProfileImpact(projection) },
            )
            .setThumbnail(source.beatmapset.covers.listDouble)
            .setFooter({
                text: "Edit using the buttons",
            })
            .setTimestamp(source.endedAt);
    }

    private formatProfileImpact(projection: IFixProfileProjection): string {
        if (!projection.eligible) {
            return "This score does not award profile pp.";
        }

        if (projection.placement === null) {
            const existing =
                projection.existingBestPP === undefined
                    ? "It would not enter the top 100."
                    : `It would not beat the existing ${ScoreFormatter.pp(projection.existingBestPP)} score on this map.`;

            return `${existing}\nTotal: ${ProfileFormatter.pp(projection.currentPP)} (no change)`;
        }

        const delta = DiscordFormatter.delta(DiscordFormatter.fixed(projection.ppDifference, 1));
        let result =
            `Top play: #${projection.placement}\n` +
            `Total: ${ProfileFormatter.pp(projection.currentPP)} -> ` +
            `**${ProfileFormatter.pp(projection.projectedPP)}** (${delta}pp)`;

        if (projection.projectedRank !== undefined) {
            const rankDelta = projection.currentRank - projection.projectedRank;
            result +=
                `\nRank: ${ProfileFormatter.rank(projection.currentRank)} -> ` +
                `**${ProfileFormatter.rank(projection.projectedRank)}** (${DiscordFormatter.delta(rankDelta)})`;
        }

        return result;
    }

    private createComponents(
        sessionID: string,
        data: FixViewDto,
        calculatedAccuracy: number,
        combo: number,
        maxCombo: number,
    ): ActionRow {
        const manualHits = this.hasManualHitCounts(data);

        return new ActionRow()
            .addButton(
                `Accuracy: ${manualHits ? "From hits" : ScoreFormatter.accuracy(data.accuracy ?? calculatedAccuracy)}`,
                `osu_fix:accuracy:${sessionID}`,
                ButtonStyle.Secondary,
            )
            .addButton(`Misses: ${data.statistics.countMiss ?? 0}`, `osu_fix:misses:${sessionID}`, ButtonStyle.Danger)
            .addButton(
                `Combo: ${combo === maxCombo ? "Max" : `${combo}x`}`,
                `osu_fix:combo:${sessionID}`,
                ButtonStyle.Secondary,
            )
            .addButton(
                `Hit Counts: ${manualHits ? "Custom" : "Auto"}`,
                `osu_fix:hits:${sessionID}`,
                ButtonStyle.Success,
            )
            .addButton("Reset FC", `osu_fix:reset:${sessionID}`, ButtonStyle.Primary);
    }

    private hasManualHitCounts(data: FixViewDto): boolean {
        const statistics = data.statistics;
        const mode = data.sourceScore.mode ?? data.profile.mode;

        if (mode === GameMode.Mania) {
            return [
                statistics.countGeki,
                statistics.count300,
                statistics.countKatu,
                statistics.count100,
                statistics.count50,
            ].some((value) => value !== undefined);
        }

        return [statistics.count300, statistics.count100, statistics.count50].some((value) => value !== undefined);
    }

    private formatHits(mode: GameMode, hitResults: HitResultResponse): string {
        const statistics =
            mode === GameMode.Mania
                ? [
                      hitResults.countGeki,
                      hitResults.count300,
                      hitResults.countKatu,
                      hitResults.count100,
                      hitResults.count50,
                      hitResults.countMiss,
                  ]
                : [hitResults.count300, hitResults.count100, hitResults.count50, hitResults.countMiss];

        return `[${statistics.join(scoreStatsCompactDelimiter)}]`;
    }
}
