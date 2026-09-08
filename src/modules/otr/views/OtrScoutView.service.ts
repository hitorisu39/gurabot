import { Import } from "@/core/decorators";
import { TMessagePayload } from "@/core/discord/context/MessagePayload";
import { ActionRow } from "@/core/discord/ui/ActionRow";
import { Embed } from "@/core/discord/ui/Embed";
import { SelectMenu } from "@/core/discord/ui/SelectMenu";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { OtrProfileViewService } from "@/modules/otr/views/OtrProfileView.service";
import { discordMaxVisualLineLength } from "@domain/discord/configs/Discord.config";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { TextFormatter } from "@domain/discord/formatters/Text.formatter";
import { EMultiplayerTargetType } from "@domain/osu/enums/Multiplayer.enum";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { MultiplayerFormatter } from "@domain/osu/formatters/Multiplayer.formatter";
import { ScoreFormatter } from "@domain/osu/formatters/Score.formatter";
import { OtrFormatter } from "@domain/otr/formatters/Otr.formatter";
import { OtrMatchFormatter } from "@domain/otr/formatters/OtrMatch.formatter";
import { OtrProfileFormatter } from "@domain/otr/formatters/OtrProfile.formatter";
import { OtrPlayerRatingAdjustmentDto, OtrPlayerStatsDto } from "@domain/otr/OtrPlayer.dto";
import { OtrScoutEventDto, OtrScoutGameDto, OtrScoutMatchDto, OtrScoutModSummaryDto } from "@domain/otr/OtrScout.dto";
import { EOtrScoutView, OtrScoutViewDto } from "@domain/otr/views/OtrScout.view";
import { ModUtils } from "@generated/adapter/mods";

export class OtrScoutViewService extends AbstractViewService<OtrScoutViewDto, EOtrScoutView> {
    @Import() declare private readonly profileViewService: OtrProfileViewService;

    protected readonly ttl = 120;

    public build(sessionID: string, data: OtrScoutViewDto, view: EOtrScoutView): TMessagePayload {
        return {
            embeds: [this.view(data, view)],
            components: this.components(sessionID, data, view),
        };
    }

    public overview(data: OtrScoutViewDto): Embed {
        const embed = this.base(data);

        const rating = data.stats.rating;
        const stats = data.stats.matchStats;

        if (!rating) {
            return embed.setDescription("No o!TR rating is currently available for this player.");
        }

        const recent = this.recentAdjustments(data.stats, 5);
        const wins = recent.filter((adjustment) => adjustment.matchWon === true).length;
        const losses = recent.filter((adjustment) => adjustment.matchWon === false).length;
        const ratingDelta = recent.reduce((sum, adjustment) => sum + adjustment.ratingDelta, 0);

        if (recent.length) {
            embed.setDescription(`**Recent rated matches**\n${this.formatAdjustments(recent)}`);
        } else {
            embed.setDescription("No recent rated matches are available for this player.");
        }

        embed.addFields(
            {
                name: "Experience",
                value: [
                    `${DiscordFormatter.number(rating.tournamentsPlayed)} tournaments`,
                    `${DiscordFormatter.number(rating.matchesPlayed)} matches`,
                ].join("\n"),
                inline: true,
            },
            {
                name: "Overall Record",
                value: stats ? OtrProfileFormatter.record(stats.matchesWon, stats.matchesLost, true) : "N/A",
                inline: true,
            },
            {
                name: "Avg Match Cost",
                value: stats ? DiscordFormatter.fixed(stats.averageMatchCostAggregate, 3).toString() : "N/A",
                inline: true,
            },
            {
                name: `Recent Record`,
                value: recent.length ? OtrProfileFormatter.record(wins, losses, true) : "N/A",
                inline: true,
            },
            {
                name: "Recent Rating",
                value: recent.length ? DiscordFormatter.delta(DiscordFormatter.fixed(ratingDelta)) : "N/A",
                inline: true,
            },
            {
                name: "Peak Rating",
                value: stats?.highestRating ? DiscordFormatter.fixed(stats.highestRating).toString() : "N/A",
                inline: true,
            },
        );

        return embed;
    }

    public matches(data: OtrScoutViewDto): Embed {
        const embed = this.base(data);

        if (!data.matches?.length) {
            return embed.setDescription("No recent match details are available for this player.");
        }

        const match = data.matches.find((entry) => entry.id === data.selectedMatchID) ?? data.matches[0]!;
        const opponents = match.opponents.length ? match.opponents.join(", ") : "Unknown";

        const aboveAverage = this.mapsAboveOpponentAverage(match.games);
        const topVsOpponents = this.mapsAboveEveryOpponent(match.games);

        const comparableGames = match.games.filter((game) => game.opponentScoreDelta !== null).length;
        const ratingDelta =
            match.ratingDelta !== null ? DiscordFormatter.delta(DiscordFormatter.fixed(match.ratingDelta)) : "N/A";

        embed
            .setTitle(match.name)
            .setURL(
                MultiplayerFormatter.link(
                    match.lazer ? EMultiplayerTargetType.Room : EMultiplayerTargetType.Match,
                    match.osuID,
                ),
            )
            .setDescription(`__\`opponents\`__: ${opponents}\n\n${this.formatGames(match.games)}`);

        embed.addFields(
            {
                name: match.isTeamMatch ? "Team Result" : "Result",
                value: this.matchResult(match),
                inline: true,
            },
            {
                name: "Match Cost",
                value:
                    match.matchCostPlacement !== null
                        ? `${DiscordFormatter.fixed(match.matchCost, 3)} (#${match.matchCostPlacement})`
                        : DiscordFormatter.fixed(match.matchCost, 3).toString(),
                inline: true,
            },
            {
                name: "Rating",
                value: ratingDelta,
                inline: true,
            },

            {
                name: "Average Score",
                value: DiscordFormatter.number(Math.round(match.averageScore)),
                inline: true,
            },
            {
                name: "Average Accuracy",
                value: this.accuracy(match.averageAccuracy),
                inline: true,
            },
            {
                name: "Average Misses",
                value: DiscordFormatter.fixed(match.averageMisses, 1).toString(),
                inline: true,
            },

            {
                name: "Average Placement",
                value: `#${DiscordFormatter.fixed(match.averagePlacement, 2)}`,
                inline: true,
            },
            {
                name: "Above Opponent Avg",
                value: comparableGames ? `${aboveAverage}/${comparableGames}` : "N/A",
                inline: true,
            },
            {
                name: "Top vs Opponents",
                value: comparableGames ? `${topVsOpponents}/${comparableGames}` : "N/A",
                inline: true,
            },
        );

        return embed;
    }

    private formatGames(games: ReadonlyArray<OtrScoutGameDto>): string {
        if (!games.length) {
            return "No individual game data is available.";
        }

        return games
            .map((game, index) => {
                const header = this.gameHeader(game, index + 1);

                const placement = `\`#${game.placement}\``;
                const score = `\`${DiscordFormatter.number(game.score)}\``;
                const accuracy = `\`${this.accuracy(game.accuracy)}\``;
                const opponentDelta =
                    game.opponentScoreDelta !== null
                        ? `\`${this.percentageDelta(game.opponentScoreDelta)} vs avg\``
                        : "`N/A vs avg`";

                const misses = ScoreFormatter.miss(game.misses ?? 0, true);

                return [header, `${placement} ${score} ${accuracy} ${opponentDelta} ${misses}`].join("\n");
            })
            .join("\n");
    }

    private gameHeader(game: OtrScoutGameDto, index: number): string {
        const stars = game.starRating !== null ? MapFormatter.stars(game.starRating) : "";
        const mods = ScoreFormatter.mods(ModUtils.parse(game.mods).filter((mod) => mod.acronym !== "NF"));
        const topVsOpponents = game.opponentCount > 0 && game.opponentsOutscored === game.opponentCount;

        const suffixParts = [stars ? `[${stars}]` : "", mods, topVsOpponents ? "🏅" : ""].filter(Boolean);
        const suffix = suffixParts.join(" ");

        const prefixLength = `${index}. `.length;
        const suffixLength = suffix.length > 0 ? ` ${suffix}`.length : 0;
        const headerLimit = Math.max(20, discordMaxVisualLineLength - prefixLength - suffixLength);

        const mapHeader = MapFormatter.header(
            game.artist ?? "Unknown Artist",
            game.title ?? "Unknown Title",
            game.difficulty ?? "Unknown Difficulty",
            headerLimit,
        );

        const linkedHeader =
            game.beatmapOsuID !== null ? `[${mapHeader}](https://osu.ppy.sh/b/${game.beatmapOsuID})` : mapHeader;

        const medal = topVsOpponents
            ? game.beatmapOsuID !== null
                ? `[🏅](https://osu.ppy.sh/b/${game.beatmapOsuID} "Top score vs opponents")`
                : "🏅"
            : "";

        return [`${index}\\.`, linkedHeader, stars ? `[${stars}]` : "", mods, medal].filter(Boolean).join(" ");
    }

    private mapsAboveOpponentAverage(games: ReadonlyArray<OtrScoutGameDto>): number {
        return games.filter((game) => game.opponentScoreDelta !== null && game.opponentScoreDelta > 0).length;
    }

    private mapsAboveEveryOpponent(games: ReadonlyArray<OtrScoutGameDto>): number {
        return games.filter((game) => game.opponentCount > 0 && game.opponentsOutscored === game.opponentCount).length;
    }

    private percentageDelta(value: number): string {
        const percentage = value * 100;

        const formatted = DiscordFormatter.fixed(Math.abs(percentage), 1);

        if (percentage > 0) {
            return `+${formatted}%`;
        }

        if (percentage < 0) {
            return `-${formatted}%`;
        }

        return "0.0%";
    }

    private matchResult(match: OtrScoutMatchDto): string {
        const score = `${match.gamesWon}-${match.gamesLost}`;

        if (match.isTeamMatch) {
            return `${match.won ? "Win" : "Loss"} • ${score}`;
        }

        return `${match.won ? "Win" : "Loss"} • ${score}`;
    }

    private accuracy(value: number): string {
        const percentage = value <= 1 ? value * 100 : value;
        return `${DiscordFormatter.fixed(percentage, 2)}%`;
    }

    public mods(data: OtrScoutViewDto): Embed {
        const embed = this.base(data);

        if (!data.matches?.length) {
            return embed.setDescription("No recent match data is available for mod analysis.");
        }

        const summaries = this.modSummaries(data.matches);

        if (!summaries.length) {
            return embed.setDescription("No recent game data is available for mod analysis.");
        }

        const maps = summaries.reduce((sum, summary) => sum + summary.games, 0);

        embed.setDescription(
            `Based on **${data.matches.length} recent rated matches** and **${DiscordFormatter.number(maps)} maps**.`,
        );

        embed.addFields(
            ...summaries.map((summary) => ({
                name: summary.label,
                value: this.formatModSummary(summary),
                inline: false,
            })),
        );

        return embed;
    }

    private formatModSummary(summary: OtrScoutModSummaryDto): string {
        const ratio =
            summary.averageOpponentDelta !== null
                ? `${DiscordFormatter.fixed(1 + summary.averageOpponentDelta, 2)}x`
                : "N/A";

        return DiscordFormatter.formatInlineGrid(
            [
                {
                    label: "Maps",
                    value: DiscordFormatter.number(summary.games),
                },
                {
                    label: "vs Avg",
                    value: ratio,
                },
                {
                    label: "Top",
                    value: `${summary.topVsOpponents}/${summary.games}`,
                },
                {
                    label: "Place",
                    value: `#${DiscordFormatter.fixed(summary.averagePlacement, 2)}`,
                },
                {
                    label: "Acc",
                    value: this.accuracy(summary.averageAccuracy),
                },
                {
                    label: "Miss",
                    value: DiscordFormatter.fixed(summary.averageMisses, 1).toString(),
                },
            ],
            3,
            64,
            " ",
        );
    }

    private modSummaries(matches: ReadonlyArray<OtrScoutMatchDto>): Array<OtrScoutModSummaryDto> {
        const buckets = new Map<string, Array<OtrScoutGameDto>>();

        for (const match of matches) {
            for (const game of match.games) {
                const label = OtrFormatter.modLabel(game.mods, game.isFreeMod);

                const bucket = buckets.get(label);

                if (bucket) {
                    bucket.push(game);
                } else {
                    buckets.set(label, [game]);
                }
            }
        }

        return [...buckets.entries()]
            .map(([label, games]) => this.modSummary(label, games))
            .sort((a, b) => b.games - a.games);
    }

    private modSummary(label: string, games: ReadonlyArray<OtrScoutGameDto>): OtrScoutModSummaryDto {
        const deltas = games.flatMap((game) => (game.opponentScoreDelta !== null ? [game.opponentScoreDelta] : []));

        const averageOpponentDelta =
            deltas.length > 0 ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length : null;

        const aboveOpponentAverage = games.filter(
            (game) => game.opponentScoreDelta !== null && game.opponentScoreDelta > 0,
        ).length;

        const topVsOpponents = games.filter(
            (game) => game.opponentCount > 0 && game.opponentsOutscored === game.opponentCount,
        ).length;

        const averagePlacement =
            games.length > 0 ? games.reduce((sum, game) => sum + game.placement, 0) / games.length : 0;

        const averageAccuracy =
            games.length > 0 ? games.reduce((sum, game) => sum + game.accuracy, 0) / games.length : 0;

        const misses = games.flatMap((game) => (game.misses !== null ? [game.misses] : []));
        const averageMisses = misses.length > 0 ? misses.reduce((sum, value) => sum + value, 0) / misses.length : 0;

        return {
            label,
            games: games.length,

            averageOpponentDelta,
            aboveOpponentAverage,
            topVsOpponents,

            averagePlacement,
            averageAccuracy,
            averageMisses,
        };
    }

    public events(data: OtrScoutViewDto): Embed {
        const embed = this.base(data);

        if (!data.events?.length) {
            return embed.setDescription("No recent tournament details are available for this player.");
        }

        const events = [...data.events].sort((a, b) => (b.startTime?.getTime() ?? 0) - (a.startTime?.getTime() ?? 0));
        const matchesWon = events.reduce((sum, event) => sum + event.matchesWon, 0);
        const matchesLost = events.reduce((sum, event) => sum + event.matchesLost, 0);
        const matchesPlayed = events.reduce((sum, event) => sum + event.matchesPlayed, 0);
        const ratingDelta = events.reduce((sum, event) => sum + (event.ratingAfter - event.ratingBefore), 0);

        const weightedMatchCost =
            matchesPlayed > 0
                ? events.reduce((sum, event) => sum + event.averageMatchCost * event.matchesPlayed, 0) / matchesPlayed
                : null;

        embed.setDescription(events.map((event) => this.formatEvent(event)).join("\n")).addFields(
            {
                name: "Match Record",
                value: OtrProfileFormatter.record(matchesWon, matchesLost, true),
                inline: true,
            },
            {
                name: "Rating Change",
                value: DiscordFormatter.delta(DiscordFormatter.fixed(ratingDelta)),
                inline: true,
            },
            {
                name: "Avg Match Cost",
                value: weightedMatchCost !== null ? DiscordFormatter.fixed(weightedMatchCost, 3).toString() : "N/A",
                inline: true,
            },
        );

        return embed;
    }

    //#region Internal

    private base(data: OtrScoutViewDto): Embed {
        return this.profileViewService.createBaseEmbed(data.profile, data.stats, data.timestamp);
    }

    private recentAdjustments(stats: OtrPlayerStatsDto, limit: number): Array<OtrPlayerRatingAdjustmentDto> {
        return [...(stats.rating?.adjustments ?? [])]
            .filter((adjustment) => adjustment.matchID !== null && adjustment.match !== null)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, limit);
    }

    private formatAdjustments(adjustments: ReadonlyArray<OtrPlayerRatingAdjustmentDto>): string {
        if (!adjustments.length) {
            return "No recent rated matches are available.";
        }

        const names = adjustments.map((adjustment) =>
            TextFormatter.truncate(adjustment.match?.name ?? `Match #${adjustment.matchID}`, 36),
        );
        const deltas = adjustments.map((adjustment) => DiscordFormatter.delta(adjustment.ratingDelta.toFixed(2)));

        const maxNameLength = Math.max(...names.map((name) => name.length));
        const maxDeltaLength = Math.max(...deltas.map((delta) => delta.length));

        return adjustments
            .map((adjustment, index) =>
                this.formatAdjustment(adjustment, names[index]!, maxNameLength, deltas[index]!, maxDeltaLength),
            )
            .join("\n");
    }

    private formatAdjustment(
        adjustment: OtrPlayerRatingAdjustmentDto,
        name: string,
        nameLength: number,
        delta: string,
        deltaLength: number,
    ): string {
        const paddedName = name.padEnd(nameLength);
        const paddedDelta = delta.padStart(deltaLength);

        const match = adjustment.match;

        const linkedName = match
            ? DiscordFormatter.link(paddedName, OtrMatchFormatter.link(match.id), null, true)
            : `\`${paddedName}\``;

        const record =
            adjustment.gamesWon !== null && adjustment.gamesLost !== null
                ? `\`${adjustment.gamesWon}-${adjustment.gamesLost}\``
                : "`—`";

        const ratingDelta = `\`${paddedDelta}\``;
        const medal = adjustment.matchWon === true ? " 🏅" : "";

        return `${linkedName} ${record} ${ratingDelta}${medal}`;
    }

    private formatEvent(event: OtrScoutEventDto): string {
        const name = event.abbreviation || event.name;
        const delta = event.ratingAfter - event.ratingBefore;
        return `[[${name}](${event.forumUrl})] Wins: \`${event.matchesWon}\`  Loses: \`${event.matchesLost}\`  Avg. Cost: \`${event.averageMatchCost.toFixed(2)}\` \`${DiscordFormatter.delta(DiscordFormatter.fixed(delta))} TR\``;
    }

    private components(sessionID: string, data: OtrScoutViewDto, view: EOtrScoutView): Array<ActionRow> {
        const menu = new SelectMenu(`otr_scout:${sessionID}`)
            .setCurrent(view)
            .addChoice("Overview", EOtrScoutView.Overview, "Recent tournament snapshot")
            .addChoice("Matches", EOtrScoutView.Matches, "Recent match performance")
            .addChoice("Mods", EOtrScoutView.Mods, "Recent performance by mod bracket")
            .addChoice("Events", EOtrScoutView.Events, "Recent tournament performance");

        const rows = [new ActionRow().add(menu)];

        if (view === EOtrScoutView.Matches && data.matches?.length) {
            const matches = new SelectMenu(`otr_scout_match:${sessionID}`);

            if (data.selectedMatchID !== null) {
                matches.setCurrent(String(data.selectedMatchID));
            }

            for (const match of data.matches) {
                const opponent = match.opponents.length ? match.opponents.join(", ") : match.name;
                const result = match.won ? "W" : "L";

                matches.addChoice(
                    `${result} ${match.gamesWon}-${match.gamesLost} vs ${opponent}`.slice(0, 100),
                    String(match.id),
                    match.tournament ?? undefined,
                );
            }

            rows.push(new ActionRow().add(matches));
        }

        return rows;
    }

    private view(data: OtrScoutViewDto, view: EOtrScoutView): Embed {
        switch (view) {
            case EOtrScoutView.Overview:
                return this.overview(data);
            case EOtrScoutView.Matches:
                return this.matches(data);
            case EOtrScoutView.Mods:
                return this.mods(data);
            case EOtrScoutView.Events:
                return this.events(data);
            default:
                return this.overview(data);
        }
    }

    //#endregion
}
