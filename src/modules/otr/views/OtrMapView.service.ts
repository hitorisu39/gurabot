import { Import } from "@/core/decorators";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { ActionRow } from "@/core/discord/ui/ActionRow";
import { Embed } from "@/core/discord/ui/Embed";
import { SelectMenu } from "@/core/discord/ui/SelectMenu";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { CalculatorService } from "@/modules/osu/calculator/Calculator.service";
import { GraphStrainService } from "@/modules/osu/graph/GraphStrain.service";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { ScoreFormatter } from "@domain/osu/formatters/Score.formatter";
import { OtrBeatmapTournamentUsageDto } from "@domain/otr/OtrBeatmap.dto";
import { EOtrMapView, OtrMapViewDto } from "@domain/otr/views/OtrMap.view";
import { AdapterProvider, Beatmap, GameMode } from "@generated/adapter/types";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { IDifficultyCalculationResponse } from "@domain/core/Calculator";
import { BeatmapUtils } from "@domain/osu/utils/BeatmapUtils";
import { OtrFormatter } from "@domain/otr/formatters/Otr.formatter";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";
import { OtrService } from "../api/Otr.service";
import {
    otrBeatmapRankRangeLabel,
    otrMapLeaderboardPageSize,
    otrMapTournamentsPageSize,
} from "@domain/otr/configs/OtrMap.config";
import { Pagination } from "@domain/discord/utils/Pagination";

export class OtrMapViewService extends AbstractViewService<OtrMapViewDto, EOtrMapView> {
    @Import() declare private readonly calculatorService: CalculatorService;
    @Import() declare private readonly graphStrainService: GraphStrainService;
    @Import() declare private readonly otrService: OtrService;

    protected readonly ttl = 180;

    public async build(
        sessionID: string,
        data: OtrMapViewDto,
        view: EOtrMapView = EOtrMapView.Leaderboard,
    ): Promise<TMessagePayload> {
        const components = this.components(sessionID, data, view);

        if (view === EOtrMapView.Overview) {
            const map = this.getBeatmap(data);
            const difficulty = await this.calculatorService.difficultyFull(map.id, map.mode, []);
            const embed = this.overview(data, difficulty);

            const payload: TMessagePayload = {
                embeds: [embed],
                components,
            };

            return payload;
        } else if (view === EOtrMapView.Leaderboard) {
            return {
                embeds: [await this.leaderboard(data)],
                components,
            };
        } else {
            return {
                embeds: [await this.tournaments(data)],
                components,
            };
        }
    }

    public overview(data: OtrMapViewDto, difficulty: IDifficultyCalculationResponse<GameMode>): Embed {
        const embed = this.createBaseEmbed(data);
        const map = this.getBeatmap(data);

        const attributes = difficulty.attributes;
        const beatmapAttributes = difficulty.beatmap;

        const bpm = BeatmapUtils.bpm(map.bpm, beatmapAttributes.clockRate);

        const totalLength = BeatmapUtils.length(map.totalLength, beatmapAttributes.clockRate);
        const hitLength = BeatmapUtils.length(map.hitLength, beatmapAttributes.clockRate);
        const delimiter = DiscordFormatter.space(4);

        embed.addFields({
            inline: true,
            name:
                `${MapFormatter.difficultyEmote(map.mode, attributes.starRating)} ` +
                `__${map.version} [${MapFormatter.stars(attributes.starRating)}]__ ` +
                `${ScoreFormatter.mods([])}`,
            value:
                `Length: \`${MapFormatter.length(totalLength)}\` ` +
                `(\`${MapFormatter.length(hitLength)}\`)` +
                `${delimiter}Combo: \`${attributes.maxCombo}x\`\n` +
                `Circles: \`${map.countCircles}\`` +
                `${delimiter}Sliders: \`${map.countSliders}\`` +
                `${delimiter}Spinners: \`${map.countSpinners}\`\n` +
                `CS\`${DiscordFormatter.fixed(beatmapAttributes.cs)}\` ` +
                `AR\`${DiscordFormatter.fixed(beatmapAttributes.ar)}\` ` +
                `OD\`${DiscordFormatter.fixed(beatmapAttributes.od)}\` ` +
                `HP\`${DiscordFormatter.fixed(beatmapAttributes.hp)}\` ` +
                `BPM\`${DiscordFormatter.fixed(bpm)}\``,
        });

        const tournamentUsage = this.formatTournamentUsage(data);
        embed.addFields({
            name: "Tournament Usage",
            value: tournamentUsage,
            inline: false,
        });

        const poolMods = this.formatPoolMods(data);
        if (poolMods) {
            embed.addFields({
                name: "Pool Mods",
                value: poolMods,
                inline: false,
            });
        }

        const rankRangeMods = this.formatRankRangeMods(data);
        if (rankRangeMods) {
            embed.addFields({
                name: "Common Mods by Rank Range",
                value: rankRangeMods,
                inline: false,
            });
        }

        return embed;
    }

    public async leaderboard(data: OtrMapViewDto): Promise<Embed> {
        const embed = this.createBaseEmbed(data);
        const total = data.stats.topPerformers.length;

        if (!total) {
            return embed.setDescription("No verified tournament scores were found for this beatmap.");
        }

        const totalPages = Math.ceil(total / otrMapLeaderboardPageSize);

        const page = Math.min(Math.max(data.leaderboardPage, 1), totalPages);
        const start = (page - 1) * otrMapLeaderboardPageSize;

        const performers = data.stats.topPerformers.slice(start, start + otrMapLeaderboardPageSize);
        const tournamentIDs = [...new Set(performers.map((entry) => entry.tournament.id))];
        const tournaments = await Promise.all(tournamentIDs.map((id) => this.otrService.tournament(id)));
        const tournamentByID = new Map(tournaments.map((tournament) => [tournament.id, tournament]));

        const lines = performers.map((entry, index) => {
            const placement = start + index + 1;
            const profileURL = ProfileFormatter.link(AdapterProvider.Bancho, entry.player.osuID);
            const tournament = tournamentByID.get(entry.tournament.id);

            const tournamentText = tournament?.forumUrl
                ? `[${entry.tournament.name}](${tournament.forumUrl})`
                : entry.tournament.name;

            return (
                `**${placement}\\. ` +
                `[${entry.player.username}](${profileURL})** ` +
                `\`${DiscordFormatter.number(entry.score)}\` ` +
                `\`${OtrFormatter.modLabel(entry.mods)}\` ` +
                `${DateFormatter.discord(entry.playedAt ?? 0, "R")}\n` +
                `└ ${tournamentText}`
            );
        });

        return embed.setDescription(lines.join("\n"));
    }

    public async tournaments(data: OtrMapViewDto): Promise<Embed> {
        const embed = this.createBaseEmbed(data);

        const tournaments = this.sortedTournaments(data);

        if (!tournaments.length) {
            return embed.setDescription("No tournament history was found for this beatmap.");
        }

        const totalPages = Math.ceil(tournaments.length / otrMapTournamentsPageSize);
        const page = Math.min(Math.max(data.tournamentsPage, 1), totalPages);

        const start = (page - 1) * otrMapTournamentsPageSize;
        const pageTournaments = tournaments.slice(start, start + otrMapTournamentsPageSize);

        const details = await Promise.all(
            pageTournaments.map((entry) => this.otrService.tournament(entry.tournament.id)),
        );

        const detailByID = new Map(details.map((tournament) => [tournament.id, tournament]));

        const lines = pageTournaments.map((entry, index) => {
            const placement = start + index + 1;
            const detail = detailByID.get(entry.tournament.id);
            return this.formatTournament(placement, entry, detail?.forumUrl);
        });

        return embed.setDescription(lines.join("\n"));
    }

    //#region Internal

    private createBaseEmbed(data: OtrMapViewDto): Embed {
        const mapset = data.beatmapset;
        const map = this.getBeatmap(data);

        return new Embed()
            .setTitle(`${mapset.artist} - ${mapset.title}`)
            .setURL(MapFormatter.link(map.id))
            .setAuthor({
                name: `Mapset by ${mapset.creator}`,
                iconURL: ProfileFormatter.avatar(AdapterProvider.Bancho, mapset.userID, data.timestamp),
                url: ProfileFormatter.link(AdapterProvider.Bancho, mapset.userID),
            })
            .setFooter({
                text: `o!TR • ${map.status}`,
            })
            .setTimestamp(mapset.rankedDate ?? map.lastUpdated);
    }

    private components(sessionID: string, data: OtrMapViewDto, view: EOtrMapView): Array<ActionRow> {
        const menu = new SelectMenu(`otr_map:${sessionID}`)
            .setCurrent(view)
            .addChoice("Overview", EOtrMapView.Overview, "Tournament usage and beatmap statistics")
            .addChoice("Leaderboard", EOtrMapView.Leaderboard, "Top verified tournament scores")
            .addChoice("Tournaments", EOtrMapView.Tournaments, "Tournaments that pooled this beatmap");

        const rows = [new ActionRow().add(menu)];

        if (view === EOtrMapView.Leaderboard) {
            const totalPages = Math.ceil(data.stats.topPerformers.length / otrMapLeaderboardPageSize);
            if (totalPages > 1) {
                rows.push(Pagination.build("otr_map_leaderboard", sessionID, data.leaderboardPage, totalPages));
            }
        } else if (view === EOtrMapView.Tournaments) {
            const totalPages = Math.ceil(data.stats.tournaments.length / otrMapTournamentsPageSize);
            if (totalPages > 1) {
                rows.push(Pagination.build("otr_map_tournaments", sessionID, data.tournamentsPage, totalPages));
            }
        }

        return rows;
    }

    private getBeatmap(data: OtrMapViewDto): Beatmap {
        const beatmap = data.beatmapset.beatmaps?.find((beatmap) => beatmap.id === data.beatmapID);
        if (!beatmap) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "Current beatmap was not found in beatmapset.");
        }

        return beatmap;
    }

    private formatTournamentUsage(data: OtrMapViewDto): string {
        const { summary, performance, freemodPicks } = data.stats;

        const pickRate =
            summary.totalTournamentCount > 0
                ? (summary.pooledPlayedTournamentCount / summary.totalTournamentCount) * 100
                : null;

        const missless = performance.missDistribution.find((bucket) => bucket.misses === 0);
        const misslessRate =
            performance.missDataScoreCount > 0
                ? ((missless?.scoreCount ?? 0) / performance.missDataScoreCount) * 100
                : null;

        return DiscordFormatter.formatInlineGrid(
            [
                {
                    label: "Pools:",
                    value: DiscordFormatter.number(summary.totalTournamentCount),
                },
                {
                    label: "Verified:",
                    value: DiscordFormatter.number(summary.verifiedTournamentCount),
                },
                {
                    label: "Played:",
                    value: DiscordFormatter.number(summary.pooledPlayedTournamentCount),
                },

                {
                    label: "Pick rate:",
                    value: pickRate === null ? "N/A" : `${DiscordFormatter.fixed(pickRate)}%`,
                },
                {
                    label: "Games:",
                    value: DiscordFormatter.number(summary.totalPlayedGameCount),
                },
                {
                    label: "V. games:",
                    value: DiscordFormatter.number(summary.totalGameCount),
                },

                {
                    label: "Scores:",
                    value: DiscordFormatter.number(performance.scoreCount),
                },
                {
                    label: "Missless:",
                    value: misslessRate === null ? "N/A" : `${DiscordFormatter.fixed(misslessRate)}%`,
                },
                {
                    label: "FM games:",
                    value: DiscordFormatter.number(freemodPicks.freemodGameCount),
                },
            ],
            3,
            64,
            " • ",
        );
    }

    private formatPoolMods(data: OtrMapViewDto): string | null {
        const counts = new Map<string, number>();

        for (const tournament of data.stats.tournaments) {
            if (tournament.gameCount <= 0 || tournament.mostCommonMods === null) {
                continue;
            }

            const mods = OtrFormatter.modLabel(tournament.mostCommonMods, tournament.mostCommonModsFreemod);
            counts.set(mods, (counts.get(mods) ?? 0) + 1);
        }

        const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
        if (!total) {
            return null;
        }

        const items = [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([mods, count]) => ({
                label: `${mods}:`,
                value: `${DiscordFormatter.fixed((count / total) * 100)}% (${DiscordFormatter.number(count)}x)`,
            }));

        return DiscordFormatter.formatInlineGrid(items, 3, 64, " • ");
    }

    private formatRankRangeMods(data: OtrMapViewDto): string | null {
        const items = data.stats.rankRangeModDistribution
            .map((bucket) => {
                const mostCommon = bucket.distribution[0];
                if (!mostCommon) {
                    return null;
                }

                return {
                    label: `${otrBeatmapRankRangeLabel[bucket.rankRange]}:`,
                    value:
                        `${OtrFormatter.modLabel(mostCommon.mods)} ` +
                        `${DiscordFormatter.fixed(mostCommon.percentage)}%`,
                };
            })
            .filter(
                (
                    entry,
                ): entry is {
                    label: string;
                    value: string;
                } => entry !== null,
            );

        if (!items.length) {
            return null;
        }

        return DiscordFormatter.formatInlineGrid(items, 3, 64, " • ");
    }

    private formatTournament(
        placement: number,
        tournament: OtrBeatmapTournamentUsageDto,
        forumUrl?: string | null,
    ): string {
        const name = forumUrl ? `[${tournament.tournament.name}](${forumUrl})` : tournament.tournament.name;
        const lobby = `${tournament.lobbySize}v${tournament.lobbySize}`;

        const rankRange =
            tournament.rankRangeLowerBound <= 1
                ? "Open"
                : `${DiscordFormatter.number(tournament.rankRangeLowerBound)}+`;

        const status = OtrFormatter.verification(tournament.verificationStatus);
        const mods =
            tournament.mostCommonMods === null
                ? "N/A"
                : OtrFormatter.modLabel(tournament.mostCommonMods, tournament.mostCommonModsFreemod);

        const date = DateFormatter.discord(tournament.endTime ?? tournament.startTime ?? 0, "R");

        return (
            `${placement}\\. **${name}** ` +
            `\`${lobby}\` ` +
            `\`${rankRange}\` ` +
            `\`${status}\`` +
            "\n" +
            `└ Games: \`${DiscordFormatter.number(tournament.gameCount)}\` • ` +
            `Scores: \`${DiscordFormatter.number(tournament.scoreCount)}\` • ` +
            `Mod: \`${mods}\` • ` +
            `${date}`
        );
    }

    private sortedTournaments(data: OtrMapViewDto): Array<OtrBeatmapTournamentUsageDto> {
        return [...data.stats.tournaments].sort((a, b) => {
            const aDate = a.endTime ?? a.startTime;
            const bDate = b.endTime ?? b.startTime;

            if (!aDate && !bDate) {
                return 0;
            }

            if (!aDate) {
                return 1;
            }

            if (!bDate) {
                return -1;
            }

            return bDate.getTime() - aDate.getTime();
        });
    }

    //#endregion
}
