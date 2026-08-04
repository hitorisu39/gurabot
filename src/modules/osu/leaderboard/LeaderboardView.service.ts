import { Import } from "@/core/decorators";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { DescriptionBuilder } from "@/core/discord/ui/DescriptionBuilder";
import { Embed } from "@/core/discord/ui/Embed";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { OsuService } from "@/modules/osu/Osu.service";
import { Pagination } from "@domain/discord/utils/Pagination";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { PopulatedScore, ScoreWithMaps } from "@domain/osu/Score.dto";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { ScoreFormatter } from "@domain/osu/formatters/Score.formatter";
import { ScoreUtils } from "@domain/osu/utils/ScoreUtils";
import { LeaderboardViewDto } from "@domain/osu/views/Leaderboard.view";
import { GameMode, Score } from "@generated/adapter/types";
import { plainToInstance } from "class-transformer";
import { scoreStatsDelimiter } from "@domain/osu/configs/Score.config";

export class LeaderboardViewService extends AbstractViewService<LeaderboardViewDto, Record<string, unknown>> {
    @Import()
    declare private readonly osuService: OsuService;

    protected readonly ttl: number = 180;
    private readonly pageSize: number = 10;

    public build(sessionID: string, data: LeaderboardViewDto, _meta?: Record<string, unknown>): TMessagePayload {
        const totalPages = this.getTotalPages(data);
        const pageScores = this.getPageScores(data);

        const components =
            totalPages > 1 ? [Pagination.build("osu_leaderboard", sessionID, data.page, totalPages)] : [];

        return {
            embeds: [this.createEmbed(data, pageScores)],
            components,
        };
    }

    public async prepare(data: LeaderboardViewDto): Promise<void> {
        const start = (data.page - 1) * this.pageSize;
        const pageScores = data.scores.slice(start, start + this.pageSize);

        if (!pageScores.length) {
            return;
        }

        if (pageScores.every((score) => ScoreUtils.isFullyPopulated(score))) {
            return;
        }

        const beatmapset = data.beatmap.beatmapset;

        if (!beatmapset) {
            return;
        }

        const scoresWithMaps = plainToInstance(
            ScoreWithMaps,
            pageScores.map((score) => ({
                ...score,
                beatmap: data.beatmap,
                beatmapset,
            })),
        );

        const populated = await this.osuService.populateCalculations(scoresWithMaps, data.beatmap.mode, true);
        data.scores.splice(start, pageScores.length, ...populated);
    }

    public getPageSize(): number {
        return this.pageSize;
    }

    public getTotalPages(data: LeaderboardViewDto): number {
        return Math.max(1, Math.ceil(data.scores.length / this.pageSize));
    }

    private getPageScores(data: LeaderboardViewDto): Array<Score> {
        const start = (data.page - 1) * this.pageSize;
        return data.scores.slice(start, start + this.pageSize);
    }

    private createEmbed(data: LeaderboardViewDto, pageScores: Array<Score>): Embed {
        const embed = new Embed();
        const beatmapset = data.beatmap.beatmapset;

        if (!beatmapset) {
            return embed.setDescription("Beatmapset information is unavailable.");
        }

        const firstScore = data.scores[0];

        embed.setAuthor({
            name: `${MapFormatter.header(
                beatmapset.artist,
                beatmapset.title,
                data.beatmap.version,
                80,
            )} [${MapFormatter.stars(data.starRating)}]`,
            url: MapFormatter.link(data.beatmap.id),
            ...(firstScore
                ? {
                      iconURL: ProfileFormatter.avatar(data.provider, firstScore.userID, data.timestamp),
                  }
                : {}),
        });

        if (beatmapset.covers?.listDouble) {
            embed.setThumbnail(beatmapset.covers.listDouble);
        }

        const description = new DescriptionBuilder();

        for (const score of pageScores) {
            if (!ScoreUtils.isFullyPopulated(score)) {
                continue;
            }

            description.add(this.formatScore(score as PopulatedScore, data));
        }

        return embed.setDescription(description.buildOr("No leaderboard scores.")).setFooter({
            text: `${data.beatmap.status} by ${beatmapset.creator}`,
            iconURL: ProfileFormatter.modeIcon(data.beatmap.mode),
        });
    }

    private formatScore(score: PopulatedScore, data: LeaderboardViewDto): string {
        const username = score.user?.username ?? `User ${score.userID}`;

        const userLink = ProfileFormatter.link(data.provider, score.userID, data.beatmap.mode);

        const totalScore = DiscordFormatter.number(score.totalScore);
        const scoreDisplay = `\`${totalScore}\``;

        const mods = ScoreFormatter.mods(score.mods);
        const modsDisplay = mods ? `\`${mods}\`` : null;

        const age = `\`${DateFormatter.age(score.endedAt)}\``;

        const firstRow = [`**${score.index}\\.** **[${username}](${userLink})**`, scoreDisplay, modsDisplay, age]
            .filter(Boolean)
            .join(DiscordFormatter.space(2));

        const grade = ScoreFormatter.grade(score.grade, score.passed, score.id);
        const accuracy = ScoreFormatter.accuracy(score.accuracy);

        const pp = ScoreFormatter.pp(
            score.pp ?? score.calculated.attributes.total,
            score.calculatedFC?.attributes.total,
        );

        const combo = this.formatCombo(score, data.beatmap.mode);
        const statistics = ScoreFormatter.statistics(score.statistics, data.beatmap.mode, "/");

        const secondRow = [`${grade} ${accuracy}`, pp, combo, `${statistics}`]
            .filter(Boolean)
            .join(scoreStatsDelimiter);

        return `${firstRow}\n${secondRow}`;
    }

    private formatCombo(score: PopulatedScore, mode: GameMode): string {
        if (mode !== GameMode.Mania) {
            return ScoreFormatter.combo(score.maxCombo, score.fullDifficulty.maxCombo, true);
        }

        const perfect = score.statistics.perfect ?? 0;
        const great = score.statistics.great ?? 0;

        const ratio = great > 0 ? (perfect / great).toFixed(2) : perfect.toString();

        return `${ScoreFormatter.combo(score.maxCombo)} / **${ratio}**`;
    }
}
