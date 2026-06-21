import { Import } from "@/core/decorators";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { Embed } from "@/core/discord/ui/Embed";
import { AbstractService } from "@/core/framework/AbstractService";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";
import { Pagination } from "@domain/discord/utils/Pagination";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { PopulatedScore } from "@domain/osu/Score.dto";
import { ScoresViewDto } from "@domain/osu/views/Scores.view";
import { AdapterProvider, GameMode, Score } from "@generated/adapter/types";
import { OsuService } from "../Osu.service";
import { ProfileViewService } from "../profile/ProfileView.service";
import { DescriptionBuilder } from "@/core/discord/ui/DescriptionBuilder";
import { ScoreFormatter } from "@domain/osu/formatters/Score.formatter";
import { discordMaxVisualLineLength } from "@domain/discord/configs/Discord.config";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { scoreCompactPageSize, scoreDetailedPageSize, scoreStatsDelimiter } from "@domain/osu/configs/Score.config";
import { BeatmapAttributesCalculator } from "@domain/osu/utils/BeatmapAttributesCalculator";
import { EScoreListSize } from "@domain/osu/enums/Score.enum";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";

export class ScoresViewService extends AbstractService {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly profileViewService: ProfileViewService;

    private readonly ttl: number = 180;

    public build(sessionID: string, data: ScoresViewDto): TMessagePayload {
        const pageSize = this.getPageSize(data.pageSize, data.activeAttributes);
        const totalPages = Math.ceil(data.scores.length / pageSize) || 1;

        const start = (data.page - 1) * pageSize;
        const end = start + pageSize;
        const pageScores = data.scores.slice(start, end);

        const components = totalPages > 1 ? [Pagination.build("osu_scores", sessionID, data.page, totalPages)] : [];
        const embed =
            data.scores.length === 1 && pageScores[0] ? this.single(data, pageScores[0]) : this.list(data, pageScores);

        return {
            content: data.displayQuery ?? undefined,
            embeds: [embed],
            components: components,
        };
    }

    public getPageSize(size: EScoreListSize, activeAttributes?: Array<string>): number {
        const detailed = size === EScoreListSize.Detailed;
        if (detailed) return scoreDetailedPageSize;

        const basePageSize = scoreCompactPageSize;
        const hasActiveAttributes = activeAttributes && activeAttributes.length > 0;

        return hasActiveAttributes ? Math.ceil(basePageSize / 2) : basePageSize;
    }

    private single(data: ScoresViewDto, score: Score): Embed {
        const embed = this.profileViewService.createBaseEmbed(data.profile, data.timestamp, false);
        if (!this.isFullyPopulated(score)) return embed;

        const description = new DescriptionBuilder();
        const isMania = data.profile.mode === GameMode.Mania;

        const stars = MapFormatter.stars(score.calculated.difficulty.attributes.starRating);
        const mods = ScoreFormatter.mods(score.mods);

        const scoreNum = DiscordFormatter.number(score.legacyTotalScore || score.totalScore);
        const scoreDisplay = isMania ? `**${scoreNum}**` : scoreNum;

        const completion = !score.passed
            ? ScoreFormatter.completion(score.statistics, score.beatmap, data.profile.mode)
            : null;
        const grade = ScoreFormatter.grade(score.grade, score.passed, null, completion);

        const accOrMods = mods
            ? `${mods} ${DiscordFormatter.space(2)} ${ScoreFormatter.accuracy(score.accuracy)}`
            : ScoreFormatter.accuracy(score.accuracy);

        const statsFirstRow = [`${grade} ${accOrMods}`, scoreDisplay, DateFormatter.discord(score.endedAt, "R")]
            .filter(Boolean)
            .join(DiscordFormatter.space(4));

        const pp = ScoreFormatter.pp(
            score.pp ?? score.calculated.attributes.total,
            score.calculatedFC?.attributes.total,
        );
        let comboRatioString;

        if (isMania) {
            const perfect = score.statistics.perfect ?? 0;
            const great = score.statistics.great ?? 0;
            const ratio = great > 0 ? (perfect / great).toFixed(2) : perfect.toString();
            comboRatioString = `${score.maxCombo}x / **${ratio}**`;
        } else {
            comboRatioString = ScoreFormatter.combo(
                score.maxCombo,
                score.calculated.difficulty.attributes.maxCombo,
                true,
            );
        }

        const hitsString = `${ScoreFormatter.statistics(score.statistics, data.profile.mode, "/")}`;
        const statsSecondRow = [pp, comboRatioString, hitsString].filter(Boolean).join(scoreStatsDelimiter);

        const attrs = BeatmapAttributesCalculator.calculate(score.beatmap, score.mods);
        const liveBpm = BeatmapAttributesCalculator.bpm(score.beatmap.bpm, attrs.clockRate);
        const liveLength = BeatmapAttributesCalculator.length(score.beatmap.totalLength, attrs.clockRate);

        const statsThirdRow = [
            `${MapFormatter.length(liveLength)}`,
            `\`CS: ${DiscordFormatter.fixed(attrs.cs)} AR: ${DiscordFormatter.fixed(attrs.ar)} OD: ${DiscordFormatter.fixed(attrs.od)} HP: ${DiscordFormatter.fixed(attrs.hp)}\``,
            `♩ ${DiscordFormatter.fixed(liveBpm)}`,
        ]
            .filter(Boolean)
            .join(scoreStatsDelimiter);

        description.add(statsSecondRow).add(statsThirdRow);

        return embed
            .setFooter({
                text: `${score.beatmap.status} by ${score.beatmapset.creator}`,
                iconURL: ProfileFormatter.modeIcon(data.profile.mode),
            })
            .addFields({ name: statsFirstRow, value: description.build() })
            .setThumbnail(score.beatmapset.covers.listDouble)
            .setTitle(`${score.beatmapset.artist} - ${score.beatmapset.title} [${score.beatmap.version}] [${stars}]`)
            .setURL(MapFormatter.link(score.beatmap.id));
    }

    private list(data: ScoresViewDto, pageScores: Array<Score>): Embed {
        const detailed = data.pageSize === EScoreListSize.Detailed;
        const embed = this.profileViewService.createBaseEmbed(data.profile, data.timestamp, false);

        if (!pageScores.length) return embed.setDescription("No scores.");

        const description = new DescriptionBuilder();
        const isMania = data.profile.mode === GameMode.Mania;

        for (const score of pageScores.values()) {
            if (!score || !this.isFullyPopulated(score)) continue;

            const index = score.index;
            const stars = MapFormatter.stars(score.calculated.difficulty.attributes.starRating);
            const mods = ScoreFormatter.mods(score.mods);

            const prefixLength = `${index}. `.length;
            const suffixLength = mods ? `[${stars}] ${mods}`.length : `[${stars}]`.length;
            const headerLimit = Math.max(20, discordMaxVisualLineLength - prefixLength - suffixLength);

            const header = ScoreFormatter.header(
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
                const statistics = ScoreFormatter.statistics(score.statistics, data.profile.mode, " • ");

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
                    isMania
                        ? null
                        : ScoreFormatter.combo(score.maxCombo, score.calculated.difficulty.attributes.maxCombo, true),
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
                    isMania
                        ? scoreDisplay
                        : ScoreFormatter.combo(score.maxCombo, score.calculated.difficulty.attributes.maxCombo),
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
                    }
                }

                if (attrStrings.length > 0) {
                    description.add(`\`${attrStrings.join("` ~ `")}\``);
                }
            }
        }

        return embed
            .setFooter({
                text: "Tip: click the grade to view the score",
                iconURL: ProfileFormatter.modeIcon(data.profile.mode),
            })
            .setDescription(description.buildOr("No scores."));
    }

    public getTtl(): number {
        return this.ttl;
    }

    public async populatePage(
        scores: Array<Score>,
        page: number,
        pageSize: number,
        mode: GameMode,
        server: AdapterProvider,
    ): Promise<void> {
        const start = (page - 1) * pageSize;
        const slice = scores.slice(start, start + pageSize);

        if (slice.every((s) => this.isFullyPopulated(s))) {
            return;
        }

        const populated = await this.osuService.populateAll(slice, mode, true, server);
        scores.splice(start, populated.length, ...populated);
    }

    public isFullyPopulated(score: Score): score is PopulatedScore {
        return score.beatmap !== undefined && score.beatmapset !== undefined && "calculated" in score;
    }
}
