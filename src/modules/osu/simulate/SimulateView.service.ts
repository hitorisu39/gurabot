import { ActionRow } from "@/core/discord/ui/ActionRow";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { Embed } from "@/core/discord/ui/Embed";
import { Import } from "@/core/decorators";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { CalculatorService } from "@/modules/osu/calculator/Calculator.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { IPerformanceCalculationResponse } from "@domain/core/Calculator";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { ESimulateScoringMode } from "@domain/osu/enums/Simulate.enum";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { ScoreFormatter } from "@domain/osu/formatters/Score.formatter";
import { SimulateScoreUtils } from "@domain/osu/utils/SimulateScoreUtils";
import { SimulateViewDto } from "@domain/osu/views/Simulate.view";
import { AdapterProvider, Beatmap, GameMode } from "@generated/adapter/types";
import { HitResultResponse } from "@generated/calculator/calculator";
import { ModUtils, ParsedMod } from "@generated/adapter/mods";
import { ButtonStyle } from "discord.js";
import { ScoreGradeEvaluator } from "@domain/osu/utils/ScoreGradeEvaluator";
import { scoreStatsCompactDelimiter, scoreStatsDelimiter } from "@domain/osu/configs/Score.config";
import { BeatmapUtils } from "@domain/osu/utils/BeatmapUtils";

export class SimulateViewService extends AbstractViewService<SimulateViewDto> {
    @Import() declare private readonly calculatorService: CalculatorService;

    protected readonly ttl: number = 180;

    public async build(sessionID: string, data: SimulateViewDto): Promise<TMessagePayload> {
        const map = data.beatmapset.beatmaps?.find((candidate) => candidate.id === data.beatmapID);

        if (!map) {
            throw new Exception(EApplicationError.NOT_FOUND, "The simulated beatmap is unavailable.");
        }

        const calculationMods = SimulateScoreUtils.calculationMods(data);
        const conflicts = ModUtils.findIncompatibilities(calculationMods);
        const conflict = Object.entries(conflicts)[0];

        if (conflict) {
            throw new Exception(
                EApplicationError.INPUT_ERROR,
                `${conflict[0]} is incompatible with ${conflict[1].join(", ")}.`,
            );
        }

        const difficulty = await this.calculatorService.difficulty(map.id, map.mode, calculationMods, data.clockRate);

        const maxCombo = difficulty.maxCombo;
        const combo = Math.max(0, Math.min(data.combo ?? maxCombo, maxCombo));

        const calculated = await this.calculatorService.performance(
            map.id,
            map.mode,
            {
                score: SimulateScoreUtils.buildScoreState(data, combo),
                precalculatedDifficulty: difficulty,
                clockRate: data.clockRate,
                legacyTotalScore: data.scoringMode === ESimulateScoringMode.Stable ? data.legacyTotalScore : undefined,
            },
            calculationMods,
        );

        if (!calculated.hitResults) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "The calculator did not return normalized hit results.",
            );
        }

        const calculatedFC = await this.calculatorService.performance(
            map.id,
            map.mode,
            {
                score: SimulateScoreUtils.buildFullComboScore(calculated.hitResults, map.mode, maxCombo),
                precalculatedDifficulty: difficulty,
                clockRate: data.clockRate,
            },
            calculationMods,
        );

        const embed = this.createEmbed(map, data, calculated, calculatedFC.attributes.total, calculationMods);

        return {
            content: "Simulated score:",
            embeds: [embed],
            components: this.createComponents(
                sessionID,
                data,
                calculated.hitResults.accuracy,
                calculated.difficulty.attributes.maxCombo,
                map,
            ),
        };
    }

    private createEmbed(
        map: Beatmap,
        data: SimulateViewDto,
        calculated: IPerformanceCalculationResponse<GameMode>,
        ppFC: number,
        calculationMods: Array<ParsedMod>,
    ): Embed {
        const attributes = calculated.difficulty.attributes;
        const beatmapAttributes = calculated.difficulty.beatmap;
        const hitResults = calculated.hitResults!;

        const clockRate = beatmapAttributes.clockRate;
        const liveBpm = BeatmapUtils.bpm(map.bpm, clockRate);
        const liveTotalLength = BeatmapUtils.length(map.totalLength, clockRate);
        const liveHitLength = BeatmapUtils.length(map.hitLength, clockRate);

        const grade = ScoreGradeEvaluator.evaluate(map.mode, hitResults, calculationMods);
        const mods = ScoreFormatter.mods(data.mods) || "NM";
        const rateSuffix = clockRate !== 1 ? ` • ${clockRate.toFixed(2)}x` : "";

        const mapValue = [
            [
                `Length \`${MapFormatter.length(liveTotalLength)}\` (\`${MapFormatter.length(liveHitLength)}\`)`,
                `BPM \`${DiscordFormatter.fixed(liveBpm)}\``,
                `Combo \`${attributes.maxCombo}x\``,
            ].join(scoreStatsDelimiter),
            [
                `CS \`${DiscordFormatter.fixed(beatmapAttributes.cs)}\``,
                `AR \`${DiscordFormatter.fixed(beatmapAttributes.ar)}\``,
                `OD \`${DiscordFormatter.fixed(beatmapAttributes.od)}\``,
                `HP \`${DiscordFormatter.fixed(beatmapAttributes.hp)}\``,
            ].join(scoreStatsDelimiter),
        ].join("\n");

        const scoreParts = [
            `${ScoreFormatter.grade(grade, true)} ${ScoreFormatter.accuracy(hitResults.accuracy)}`,
            ScoreFormatter.combo(hitResults.maxCombo, attributes.maxCombo, true),
            ScoreFormatter.pp(calculated.attributes.total, ppFC),
        ];

        if (data.scoringMode === ESimulateScoringMode.Stable && data.legacyTotalScore !== undefined) {
            scoreParts.push(`Score \`${DiscordFormatter.number(data.legacyTotalScore)}\``);
        }

        const scoreValue = scoreParts.join(scoreStatsDelimiter);

        const description =
            `${MapFormatter.difficultyEmote(map.mode, attributes.starRating)} ` +
            `**[${map.version}](${MapFormatter.link(map.id)})**` +
            `${DiscordFormatter.space(1)}\`${MapFormatter.stars(attributes.starRating)}\`` +
            `${DiscordFormatter.space(1)}\`${mods}\`` +
            rateSuffix;

        return new Embed()
            .setTitle(`${data.beatmapset.artist} - ${data.beatmapset.title}`)
            .setURL(MapFormatter.link(map.id))
            .setAuthor({
                name: `Mapset by ${data.beatmapset.creator}`,
                iconURL: ProfileFormatter.avatar(AdapterProvider.Bancho, data.beatmapset.userID, data.timestamp),
                url: ProfileFormatter.link(AdapterProvider.Bancho, data.beatmapset.userID),
            })
            .setDescription(description)
            .addFields(
                {
                    name: "Map",
                    value: mapValue,
                },
                {
                    name: "Score",
                    value: scoreValue,
                },
                {
                    name: "Hits",
                    value: this.formatHits(map.mode, hitResults, data.scoringMode),
                },
            )
            .setFooter({
                text:
                    `${data.scoringMode === ESimulateScoringMode.Lazer ? "Lazer" : "Stable"} scoring` +
                    " • Edit the simulation using the buttons below",
            })
            .setTimestamp(data.beatmapset.rankedDate ?? map.lastUpdated);
    }

    private createComponents(
        sessionID: string,
        data: SimulateViewDto,
        calculatedAccuracy: number,
        maxCombo: number,
        map: Beatmap,
    ): Array<ActionRow> {
        const mods = data.mods.length ? data.mods.map((mod) => mod.acronym).join("") : "NM";
        const effectiveRate = data.clockRate ?? undefined;
        const effectiveBpm = BeatmapUtils.bpm(map.bpm, effectiveRate ?? this.modClockRate(data));
        const attributeCount = Object.values(data.attributes).filter((value) => value !== undefined).length;

        const settingsRow = new ActionRow()
            .addButton(this.label("Mods", mods), `osu_simulate_mods:${sessionID}`, ButtonStyle.Secondary)
            .addButton(
                this.label(
                    "Accuracy",
                    data.accuracy !== undefined
                        ? ScoreFormatter.accuracy(data.accuracy)
                        : `Auto (${ScoreFormatter.accuracy(calculatedAccuracy)})`,
                ),
                `osu_simulate_accuracy:${sessionID}`,
                ButtonStyle.Secondary,
            )
            .addButton(
                this.label("Combo", data.combo !== undefined ? `${Math.min(data.combo, maxCombo)}x` : "Max"),
                `osu_simulate_combo:${sessionID}`,
                ButtonStyle.Secondary,
            )
            .addButton(
                this.label("BPM", DiscordFormatter.fixed(effectiveBpm)),
                `osu_simulate_rate:${sessionID}`,
                ButtonStyle.Secondary,
            )
            .addButton(
                this.label("Attributes", attributeCount ? `${attributeCount} custom` : "Auto"),
                `osu_simulate_attributes:${sessionID}`,
                ButtonStyle.Secondary,
            );

        const hitCountsRow = new ActionRow()
            .addButton(
                this.label("Hit Counts", SimulateScoreUtils.hasManualHitCounts(data) ? "Custom" : "Auto"),
                `osu_simulate_hits:${sessionID}`,
                ButtonStyle.Success,
            )
            .addButton(
                this.label("Misses", data.statistics.countMiss ?? 0),
                `osu_simulate_misses:${sessionID}`,
                ButtonStyle.Danger,
            );

        const isStandard = map.mode === GameMode.Standard;
        const isLazer = data.scoringMode === ESimulateScoringMode.Lazer;

        const scoringRow = new ActionRow()
            .addButton(
                this.label("Slider Ends", data.statistics.countSliderTailMisses ?? "Auto"),
                `osu_simulate_slider_ends:${sessionID}`,
                ButtonStyle.Secondary,
                { disabled: !isStandard || !isLazer },
            )
            .addButton(
                this.label("Large Ticks", data.statistics.countLargeTickMisses ?? "Auto"),
                `osu_simulate_large_ticks:${sessionID}`,
                ButtonStyle.Secondary,
                { disabled: !isStandard || !isLazer },
            )
            .addButton(
                this.label(
                    "Score",
                    data.legacyTotalScore !== undefined ? DiscordFormatter.number(data.legacyTotalScore) : "Auto",
                ),
                `osu_simulate_score:${sessionID}`,
                ButtonStyle.Secondary,
                { disabled: isLazer },
            )
            .addButton(
                data.scoringMode === ESimulateScoringMode.Lazer ? "Lazer" : "Stable",
                `osu_simulate_scoring:${sessionID}`,
                ButtonStyle.Primary,
            );

        return [hitCountsRow, settingsRow, scoringRow];
    }

    private formatHits(mode: GameMode, hitResults: HitResultResponse, scoringMode: ESimulateScoringMode): string {
        switch (mode) {
            case GameMode.Standard: {
                const lines = [
                    [
                        `300 \`${hitResults.count300}\``,
                        `100 \`${hitResults.count100}\``,
                        `50 \`${hitResults.count50}\``,
                        `Miss \`${hitResults.countMiss}\``,
                    ].join(scoreStatsCompactDelimiter),
                ];

                if (scoringMode === ESimulateScoringMode.Lazer) {
                    lines.push(
                        [
                            `Slider ends \`${hitResults.countSliderTailHits}\``,
                            `Large ticks \`${hitResults.countLargeTickHits}\``,
                        ].join(scoreStatsCompactDelimiter),
                    );
                }

                return lines.join("\n");
            }

            case GameMode.Taiko:
                return [
                    `Great \`${hitResults.count300}\``,
                    `Good \`${hitResults.count100}\``,
                    `Miss \`${hitResults.countMiss}\``,
                ].join(scoreStatsCompactDelimiter);

            case GameMode.Catch:
                return [
                    [
                        `Fruits \`${hitResults.count300}\``,
                        `Droplets \`${hitResults.count100}\``,
                        `Tiny droplets \`${hitResults.count50}\``,
                    ].join(scoreStatsCompactDelimiter),
                    [`Miss \`${hitResults.countMiss}\``, `Tiny miss \`${hitResults.countKatu}\``].join(
                        scoreStatsCompactDelimiter,
                    ),
                ].join("\n");

            case GameMode.Mania:
                return [
                    [
                        `Perfect \`${hitResults.countGeki}\``,
                        `Great \`${hitResults.count300}\``,
                        `Good \`${hitResults.countKatu}\``,
                    ].join(scoreStatsCompactDelimiter),
                    [
                        `Ok \`${hitResults.count100}\``,
                        `Meh \`${hitResults.count50}\``,
                        `Miss \`${hitResults.countMiss}\``,
                    ].join(scoreStatsCompactDelimiter),
                ].join("\n");
        }
    }

    private modClockRate(data: SimulateViewDto): number {
        const rateMod = data.mods.find((mod) => ["DT", "NC", "HT", "DC"].includes(mod.acronym));

        if (!rateMod) return 1;

        if (rateMod.acronym === "DT" || rateMod.acronym === "NC") {
            return Number(rateMod.settings?.speed_change ?? 1.5);
        }

        // @ts-ignore
        return Number(rateMod.settings?.speed_change ?? 0.75);
    }

    private label(name: string, value: string | number): string {
        const label = `${name}: ${value}`;
        return label.length <= 80 ? label : `${label.slice(0, 77)}...`;
    }
}
