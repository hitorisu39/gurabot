import { EApplicationError, Exception } from "@domain/core/Exception";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { ActionRow } from "@/core/discord/ui/ActionRow";
import { DescriptionBuilder } from "@/core/discord/ui/DescriptionBuilder";
import { Embed } from "@/core/discord/ui/Embed";
import { SelectMenu } from "@/core/discord/ui/SelectMenu";
import { discordEmoteGrades } from "@domain/discord/configs/Emotes.config";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { AsciiTable } from "@domain/discord/utils/AsciiTable";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { PopulatedUser } from "@domain/osu/Profile.dto";
import { ScoresAttributesCalculator } from "@domain/osu/utils/ScoresAttributesCalculator";
import { UserAttributesCalculator } from "@domain/osu/utils/UserAttributesCalculator";
import { EProfileView, ProfileViewDto } from "@domain/osu/views/Profile.view";
import { GameMode, Genre, Grade, HighestRank, Status, UserGrades, UserLevel } from "@generated/adapter/types";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { PopulatedScoreAverageDto } from "@domain/osu/Score.dto";
import { OsuTrackPeakDto } from "@domain/osutrack/OsuTrack.dto";

interface IAverageStatRow {
    metric: string;
    min: string | number;
    avg: string | number;
    max: string | number;
}

export class ProfileViewService extends AbstractViewService<ProfileViewDto, EProfileView> {
    protected readonly ttl: number = 120;

    public build(sessionID: string, data: ProfileViewDto, view: EProfileView): TMessagePayload {
        return { embeds: this.embeds(data, view), components: this.components(sessionID, data, view) };
    }

    public overview(data: ProfileViewDto): Embed {
        const embed = this.createBaseEmbed(data.profile, data.timestamp);

        const { profile, origin, osutrack } = data;
        const { statistics, achievements, badges, highestRank } = profile;

        const description = new DescriptionBuilder()
            .addIf(highestRank, () => {
                const rank = ProfileFormatter.rank(highestRank!.rank);
                const osuTrackRank = ProfileFormatter.rank(osutrack?.peakRank ?? 0);

                const formatted =
                    osutrack && osutrack.peakRank < highestRank!.rank
                        ? DiscordFormatter.link(
                              rank,
                              origin,
                              `${osuTrackRank} on ${DateFormatter.full(osutrack.peakRankDate)} according to osu!track`,
                              true,
                          )
                        : `\`${rank}\``;

                const date = DateFormatter.discord(highestRank!.updatedAt, "d");
                return `Peak rank: ${formatted} (${date})`;
            })
            .add(
                `Playcount: \`${DiscordFormatter.number(statistics.playcount)}\` (\`${ProfileFormatter.playtime(statistics.playtime)}\`)`,
            )
            .add(
                `Accuracy: ${DiscordFormatter.link(ProfileFormatter.accuracy(statistics.accuracy), origin, statistics.accuracy, true)} • Level: \`${ProfileFormatter.level(statistics.level.current, statistics.level.progress)}\``,
            )
            .add(
                `Medals: \`${DiscordFormatter.number(achievements?.length)}\`${
                    badges?.length ? ` • Badges: \`${DiscordFormatter.number(badges.length)}\`` : ""
                }`,
            )
            .build();

        return embed.setDescription(description);
    }

    public statistics(data: ProfileViewDto): Embed {
        const embed = this.createBaseEmbed(data.profile, data.timestamp);

        const { profile, origin, osutrack, scores } = data;
        const { statistics, achievements, badges, highestRank } = profile;

        embed
            .addFields(
                { name: "Max Combo", value: ProfileFormatter.combo(statistics.maxCombo), inline: true },
                { name: "Total Score", value: DiscordFormatter.number(statistics.totalScore), inline: true },
                {
                    name: "Level",
                    value: this.formatLevel(statistics.level, statistics.totalScore, origin),
                    inline: true,
                },
            )
            .addFields(
                { name: "Peak Rank", value: this.formatPeakRank(origin, highestRank, osutrack), inline: true },
                { name: "Ranked Score", value: DiscordFormatter.number(statistics.rankedScore), inline: true },
                {
                    name: "Peak Acc",
                    value: this.formatPeakAccuracy(origin, statistics.accuracy, osutrack),
                    inline: true,
                },
            )
            .addFields(
                {
                    name: "Hits per Play",
                    value: DiscordFormatter.fixed(statistics.totalHits / statistics.playcount).toString(),
                    inline: true,
                },
                { name: "Total Hits", value: DiscordFormatter.number(statistics.totalHits), inline: true },
                { name: "Accuracy", value: ProfileFormatter.accuracy(statistics.accuracy), inline: true },
            )
            .addFields(
                {
                    name: "Rec SR*",
                    value: ProfileFormatter.recommended(UserAttributesCalculator.recommended(profile)),
                    inline: true,
                },
                {
                    name: "Top #1 PP",
                    value: DiscordFormatter.fixed(scores ? scores[0]?.pp : 0.0).toString(),
                    inline: true,
                },
                {
                    name: "Bonus PP",
                    value: DiscordFormatter.fixed(UserAttributesCalculator.bonus(profile)).toString(),
                    inline: true,
                },
            )
            .addFields(
                { name: "First places", value: DiscordFormatter.number(profile.scoresFirstCount), inline: true },
                { name: "Medals", value: DiscordFormatter.number(achievements?.length), inline: true },
                { name: "Badges", value: DiscordFormatter.number(badges?.length), inline: true },
            )
            .addFields(
                { name: "Followers", value: DiscordFormatter.number(profile.followers), inline: true },
                {
                    name: "Replays watched",
                    value: DiscordFormatter.number(UserAttributesCalculator.watchedReplays(profile)),
                    inline: true,
                },
                { name: "Playcount", value: DiscordFormatter.number(statistics.playcount), inline: true },
            )
            .addFields(
                { name: "300s", value: DiscordFormatter.number(statistics.count300), inline: true },
                { name: "100s", value: DiscordFormatter.number(statistics.count100), inline: true },
                { name: "misses", value: DiscordFormatter.number(statistics.countMiss), inline: true },
            )
            .addFields(
                {
                    name: "300 / 100 ratio",
                    value: DiscordFormatter.fixed(statistics.count300 / statistics.count100).toString(),
                    inline: true,
                },
                {
                    name: "300 / misses ratio",
                    value: DiscordFormatter.fixed(statistics.count300 / statistics.countMiss).toString(),
                    inline: true,
                },
                { name: "50s", value: DiscordFormatter.number(statistics.count50), inline: true },
            )
            .addFields({ name: "Grades", value: this.formatGrades(statistics.grades), inline: true });

        return embed;
    }

    public average(data: ProfileViewDto): Embed {
        if (!data.populated)
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                `top100 average is unavailable without populated scores.`,
            );

        const embed = this.createBaseEmbed(data.profile, data.timestamp);
        const scores = data.populated;
        const average = ScoresAttributesCalculator.average(scores);
        const difficultyRows = this.averageDifficultyRows(data.profile.mode, average);

        const tableGenerator = new AsciiTable<IAverageStatRow>({
            padding: 1,
            borders: {
                left: false,
                right: false,
                top: false,
                bottom: false,
                vertical: "|",
                horizontal: "-",
                intersection: "+",
                headerSeparator: true,
            },
            columns: [
                { header: "", accessor: "metric", align: "left" },
                { header: "Min", accessor: "min", align: "center", headerAlign: "center" },
                { header: "Avg", accessor: "avg", align: "center", headerAlign: "center" },
                { header: "Max", accessor: "max", align: "center", headerAlign: "center" },
            ],
        });

        const tableData: ReadonlyArray<IAverageStatRow> = [
            {
                metric: "Accuracy",
                min: DiscordFormatter.fixed(average.accuracy.min),
                avg: DiscordFormatter.fixed(average.accuracy.avg),
                max: DiscordFormatter.fixed(average.accuracy.max),
            },
            {
                metric: "Combo",
                min: DiscordFormatter.number(average.combo.min),
                avg: DiscordFormatter.number(average.combo.avg.toFixed(0)),
                max: DiscordFormatter.number(average.combo.max),
            },
            {
                metric: "Misses",
                min: DiscordFormatter.fixed(average.miss.min),
                avg: DiscordFormatter.fixed(average.miss.avg),
                max: DiscordFormatter.fixed(average.miss.max),
            },
            {
                metric: "PP",
                min: DiscordFormatter.fixed(average.pp.min),
                avg: DiscordFormatter.fixed(average.pp.avg),
                max: DiscordFormatter.fixed(average.pp.max),
            },
            {
                metric: "Stars",
                min: DiscordFormatter.fixed(average.stars.min),
                avg: DiscordFormatter.fixed(average.stars.avg),
                max: DiscordFormatter.fixed(average.stars.max),
            },
            ...difficultyRows,
            {
                metric: "BPM",
                min: DiscordFormatter.fixed(average.bpm.min),
                avg: DiscordFormatter.fixed(average.bpm.avg),
                max: DiscordFormatter.fixed(average.bpm.max),
            },
            {
                metric: "Length",
                min: MapFormatter.length(average.length.min),
                avg: MapFormatter.length(average.length.avg),
                max: MapFormatter.length(average.length.max),
            },
        ];

        const tableString = tableGenerator.generate(tableData);

        return embed.setDescription("```" + tableString + "```");
    }

    public mods(data: ProfileViewDto): Embed {
        if (!data.scores)
            throw new Exception(EApplicationError.INTERNAL_ERROR, `top100 mods is unavailable without scores.`);

        const embed = this.createBaseEmbed(data.profile, data.timestamp);
        const statistics = ScoresAttributesCalculator.modStatistics(data.scores);

        const favoriteModsRaw = statistics.individualMods.map((m) => ({
            label: `${m.acronym}:`,
            value: `${m.percentage.toFixed(0)}%`,
        }));

        const favoriteModCombosRaw = statistics.modCombos.map((m) => ({
            label: `${m.combo}:`,
            value: `${m.percentage.toFixed(0)}%`,
        }));

        const ppModCombosRaw = statistics.ppByCombo.map((m) => ({
            label: `${m.combo}:`,
            value: `${m.totalWeightedPP.toFixed(2)}pp`,
        }));

        embed.addFields(
            { name: "Favorite mods", value: DiscordFormatter.formatInlineGrid(favoriteModsRaw, 5), inline: false },
            {
                name: "Favorite mod combos",
                value: DiscordFormatter.formatInlineGrid(favoriteModCombosRaw),
                inline: false,
            },
            {
                name: "PP earned from mod combos",
                value: DiscordFormatter.formatInlineGrid(ppModCombosRaw),
                inline: false,
            },
        );

        return embed;
    }

    public mapper(data: ProfileViewDto): Embed {
        if (!data.scores)
            throw new Exception(EApplicationError.INTERNAL_ERROR, `top100 mappers is unavailable without scores.`);

        const embed = this.createBaseEmbed(data.profile, data.timestamp);
        const totalScores = data.scores.length;
        const { profile } = data;

        const mapperCounts = new Map<string, number>();
        const artistCounts = new Map<string, number>();
        const statusCounts = new Map<Status, number>();
        const genreCounts = new Map<Genre, number>();
        const uniqueMappers = new Set<string>();
        let ownMapsCount = 0;

        for (const score of data.scores) {
            if (!score.beatmapset) continue;

            const mapper = score.beatmapset.creator;
            const artist = score.beatmapset.artist;
            const status = score.beatmapset.status;
            const genre = score.beatmapset.genre;

            mapperCounts.set(mapper, (mapperCounts.get(mapper) ?? 0) + 1);
            artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1);
            statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
            genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
            uniqueMappers.add(mapper);

            if (mapper === data.profile.username) {
                ownMapsCount++;
            }
        }

        const sortedMappers = Array.from(mapperCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12)
            .map(([name, count]) => ({
                label: `${name}:`,
                value: `${count}`,
            }));

        const sortedArtists = Array.from(artistCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12)
            .map(([name, count]) => ({
                label: `${name}:`,
                value: `${count}`,
            }));

        const varietyPercent = (uniqueMappers.size / totalScores) * 100;

        const favoriteGenres = Array.from(genreCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([genre, count]) => ({ label: `${genre}:`, value: count.toString() }));

        const beatmapsets = [
            { label: "Ranked:", value: profile.beatmapsetRankedCount.toString() },
            { label: "Loved:", value: profile.beatmapsetLovedCount.toString() },
            { label: "Pending:", value: profile.beatmapsetPendingCount.toString() },
            { label: "Graveyard:", value: profile.beatmapsetGraveyardCount.toString() },
        ];

        embed.addFields(
            { name: "Mappers in Top 100", value: DiscordFormatter.formatInlineGrid(sortedMappers, 1), inline: true },
            { name: "Artists in Top 100", value: DiscordFormatter.formatInlineGrid(sortedArtists, 1), inline: true },
            { name: "\u200B", value: "\u200B", inline: true },

            { name: "Mapper Variety", value: `${varietyPercent.toFixed(0)}%`, inline: true },
            { name: "Own Maps in Top 100", value: `${ownMapsCount}`, inline: true },
            { name: "\u200B", value: "\u200B", inline: true },

            { name: "Beatmapsets", value: DiscordFormatter.formatInlineGrid(beatmapsets, 4, 48, " • "), inline: false },
            { name: "Favorite Genres", value: DiscordFormatter.formatInlineGrid(favoriteGenres, 4), inline: false },
        );

        return embed;
    }

    public daily(data: ProfileViewDto): Embed {
        const { profile } = data;
        if (!profile.dailyChallenge)
            throw new Exception(EApplicationError.INTERNAL_ERROR, "daily is unavailable without scores.");

        const embed = this.createBaseEmbed(data.profile, data.timestamp);

        const {
            dailyStreakCurrent,
            dailyStreakBest,
            weeklyStreakCurrent,
            weeklyStreakBest,
            playcount,
            top10p,
            top50p,
        } = profile.dailyChallenge;

        const dailyStreakValue = `🔥 **Current**: ${dailyStreakCurrent}\n👑 **Best**: ${dailyStreakBest}`;
        const weeklyStreakValue = `🔥 **Current**: ${weeklyStreakCurrent}\n👑 **Best**: ${weeklyStreakBest}`;

        const top10Percent = playcount > 0 ? (top10p / playcount) * 100 : 0;
        const top50Percent = playcount > 0 ? (top50p / playcount) * 100 : 0;

        const performanceValue =
            `🥇 **Top 10%**: ${top10p} (${top10Percent.toFixed(1)}%)\n` +
            `🥈 **Top 50%**: ${top50p} (${top50Percent.toFixed(1)}%)`;

        const participationValue = `🎮 You have completed **${playcount}** challenges.`;

        embed.addFields(
            { name: "Daily Streaks", value: dailyStreakValue, inline: true },
            { name: "\u200B", value: "\u200B", inline: true },
            { name: "Weekly Streaks", value: weeklyStreakValue, inline: true },
            { name: "Performance", value: performanceValue, inline: true },
            { name: "\u200B", value: "\u200B", inline: true },
            { name: "Total Participation", value: participationValue, inline: true },
        );

        return embed;
    }

    //#region Internal

    private components(sessionID: string, data: ProfileViewDto, view: EProfileView): Array<ActionRow> {
        const menu = new SelectMenu(`osu_profile:${sessionID}`)
            .setCurrent(view)
            .addChoice("Overview", EProfileView.Overview, "General user information")
            .addChoice("Statistics", EProfileView.Statistics, "Detailed user statistics")
            .addChoice("Mods", EProfileView.Mods, "Favorite top 100 mods")
            .addChoice("Average", EProfileView.Average, "Average top 100 statistics");

        if (data.profile.dailyChallenge) menu.addChoice("Daily", EProfileView.Daily, "Daily challenge statistics");

        menu.addChoice("Mapper", EProfileView.Mapper, "Mapper statistics");

        const row = new ActionRow().add(menu);
        return [row];
    }

    private embeds(session: ProfileViewDto, view: EProfileView): Array<Embed> {
        return [this.view(session, view)];
    }

    private view(data: ProfileViewDto, view: EProfileView): Embed {
        switch (view) {
            case EProfileView.Overview:
                return this.overview(data);
            case EProfileView.Statistics:
                return this.statistics(data);
            case EProfileView.Average:
                return this.average(data);
            case EProfileView.Mods:
                return this.mods(data);
            case EProfileView.Mapper:
                return this.mapper(data);
            case EProfileView.Daily:
                return this.daily(data);
            default:
                return this.overview(data);
        }
    }

    public createBaseEmbed(
        profile: PopulatedUser,
        timestamp: number | null = Date.now(),
        footer: boolean = true,
        ranking: boolean = true,
    ): Embed {
        const { statistics, username } = profile;

        const team = profile.team ? `[${ProfileFormatter.team(profile.team)}]` : "";
        const author = ranking
            ? `${team} ${username}: ${ProfileFormatter.pp(statistics.pp)} (${ProfileFormatter.rank(statistics.globalRank)} ${ProfileFormatter.rank(statistics.countryRank, profile.countryCode, "")})`
            : `${team} ${username}`;

        const embed = new Embed()
            .setThumbnail(ProfileFormatter.avatar(profile.provider, profile.id, timestamp))
            .setAuthor({
                name: author,
                iconURL: DiscordFormatter.countryFlag(this.config.app.flagsDomain, profile.countryCode),
                url: ProfileFormatter.link(profile.provider, profile.id, profile.mode),
            });

        if (footer)
            embed.setFooter({
                iconURL: ProfileFormatter.status(profile.online),
                text: `${ProfileFormatter.mode(profile.mode)} • Joined ${DateFormatter.full(profile.joinDate)}`,
            });

        return embed;
    }

    private formatPeakRank(origin: string, highestRank?: HighestRank, osutrack?: OsuTrackPeakDto | null): string {
        const rank = ProfileFormatter.rank(highestRank?.rank ?? 0);

        if (osutrack && osutrack.peakRank < (highestRank?.rank ?? 0)) {
            const osuTrackRank = ProfileFormatter.rank(osutrack.peakRank);
            const tooltip = `${osuTrackRank} on ${DateFormatter.full(osutrack.peakRankDate)} according to osu!track`;
            return DiscordFormatter.link(rank, origin, tooltip);
        }

        return rank;
    }

    private formatPeakAccuracy(origin: string, currentAccuracy: number, osutrack?: OsuTrackPeakDto | null): string {
        const accuracy = ProfileFormatter.accuracy(currentAccuracy);

        if (osutrack && osutrack.peakAccuracy > currentAccuracy) {
            const osuTrackAccuracy = ProfileFormatter.accuracy(osutrack.peakAccuracy);
            const tooltip = `${osuTrackAccuracy} on ${DateFormatter.full(osutrack.peakRankDate)} according to osu!track`;
            return DiscordFormatter.link(osuTrackAccuracy, origin, tooltip);
        }

        return accuracy;
    }

    private formatGrades(grades: UserGrades): string {
        return [
            `${discordEmoteGrades[Grade.SSH]}${grades.ssh}`,
            `${discordEmoteGrades[Grade.SS]}${grades.ss}`,
            `${discordEmoteGrades[Grade.SH]}${grades.sh}`,
            `${discordEmoteGrades[Grade.S]}${grades.s}`,
            `${discordEmoteGrades[Grade.A]}${grades.a}`,
        ].join(" ");
    }

    private averageDifficultyRows(mode: GameMode, average: PopulatedScoreAverageDto): ReadonlyArray<IAverageStatRow> {
        const row = (metric: string, key: "ar" | "cs" | "od" | "hp"): IAverageStatRow => ({
            metric,
            min: DiscordFormatter.fixed(average[key].min),
            avg: DiscordFormatter.fixed(average[key].avg),
            max: DiscordFormatter.fixed(average[key].max),
        });

        switch (mode) {
            case GameMode.Taiko:
                return [row("OD", "od"), row("HP", "hp")];
            case GameMode.Mania:
                return [row("Keys", "cs"), row("OD", "od"), row("HP", "hp")];
            default:
                return [row("AR", "ar"), row("CS", "cs"), row("HP", "hp"), row("OD", "od")];
        }
    }

    private formatLevel(level: UserLevel, totalScore: number, origin: string): string {
        const levelDisplayText = ProfileFormatter.level(level.current, level.progress);
        const scoreNeeded = UserAttributesCalculator.getScoreForNextLevel(totalScore);
        const tooltipText = `${DiscordFormatter.number(scoreNeeded)} score to next level`;
        return DiscordFormatter.link(levelDisplayText, origin, tooltipText);
    }

    //#endregion
}
