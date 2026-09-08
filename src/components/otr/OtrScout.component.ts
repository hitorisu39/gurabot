import { Import, SelectMenu } from "@/core/decorators";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { AbstractSessionComponent } from "@/components/AbstractSessionComponent";
import { OtrService } from "@/modules/otr/api/Otr.service";
import { OtrScoutViewService } from "@/modules/otr/views/OtrScoutView.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { OtrMatchDetailDto, OtrMatchGameDto } from "@domain/otr/OtrMatch.dto";
import { OtrTournamentDetailDto } from "@domain/otr/OtrTournament.dto";
import { EOtrScoutView, OtrScoutViewDto } from "@domain/otr/views/OtrScout.view";
import { OtrScoutEventDto, OtrScoutGameDto, OtrScoutMatchDto } from "@domain/otr/OtrScout.dto";

@SelectMenu(/^otr_scout:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OtrScoutComponent extends AbstractSessionComponent<"otr_scout_view", OtrScoutViewDto> {
    @Import() declare private readonly otrService: OtrService;
    @Import() declare private readonly scoutViewService: OtrScoutViewService;

    protected readonly sessionKey = "otr_scout_view";
    protected readonly dto = OtrScoutViewDto;

    private readonly matchLimit = 5;
    private readonly eventLimit = 5;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { sessionID } = ctx.params;

        if (!sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = await this.getData(ctx, sessionID);
        const view = ctx.values[0] as EOtrScoutView;

        if (!Object.values(EOtrScoutView).includes(view)) {
            throw new Exception(EApplicationError.INPUT_ERROR);
        }

        await ctx.deferUpdate();

        if ((view === EOtrScoutView.Matches || view === EOtrScoutView.Mods) && data.matches === null) {
            data.matches = await this.loadMatches(data);
            data.selectedMatchID = data.matches.at(0)?.id ?? null;

            await this.session.update(
                this.sessionKey,
                sessionID,
                { matches: data.matches, selectedMatchID: data.selectedMatchID },
                this.scoutViewService.getTtl(),
            );
        }

        if (view === EOtrScoutView.Events && data.events === null) {
            await this.session.bump(this.sessionKey, sessionID);
            data.events = await this.loadEvents(data);

            await this.session.update(
                this.sessionKey,
                sessionID,
                { events: data.events },
                this.scoutViewService.getTtl(),
            );
        }

        await ctx.update(this.scoutViewService.build(sessionID, data, view));
    }

    //#region Loading

    private async loadMatches(data: OtrScoutViewDto): Promise<Array<OtrScoutMatchDto>> {
        const adjustments = [...(data.stats.rating?.adjustments ?? [])]
            .filter((adjustment) => adjustment.match?.id !== undefined && adjustment.match?.id !== null)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        const matchIDs = Array.from(
            new Set(adjustments.flatMap((adjustment) => (adjustment.match ? [adjustment.match.id] : []))),
        ).slice(0, this.matchLimit);

        if (!matchIDs.length) return [];

        const results = await Promise.allSettled(matchIDs.map((id) => this.otrService.match(id)));
        return results.flatMap((result) => {
            if (result.status !== "fulfilled") {
                return [];
            }

            const summary = this.matchSummary(result.value, data.stats.playerInfo.id);
            return summary ? [summary] : [];
        });
    }

    private async loadEvents(data: OtrScoutViewDto): Promise<Array<OtrScoutEventDto>> {
        const tournaments = await this.otrService.playerTournaments(data.profile.id, {
            mode: data.profile.mode,
        });

        const tournamentIDs = [...tournaments]
            .sort((a, b) => {
                const aDate = a.startTime ?? a.created;
                const bDate = b.startTime ?? b.created;
                return bDate.getTime() - aDate.getTime();
            })
            .map((tournament) => tournament.id)
            .filter((id, index, all) => all.indexOf(id) === index)
            .slice(0, this.eventLimit);

        if (!tournamentIDs.length) return [];

        const results = await Promise.allSettled(tournamentIDs.map((id) => this.otrService.tournament(id)));

        return results.flatMap((result) => {
            if (result.status !== "fulfilled") {
                return [];
            }

            const summary = this.eventSummary(result.value, data.stats.playerInfo.id);
            return summary ? [summary] : [];
        });
    }

    //#endregion

    //#region Mapping

    private matchSummary(match: OtrMatchDetailDto, playerID: number): OtrScoutMatchDto | null {
        const stats = match.playerMatchStats.find((entry) => entry.playerID === playerID);
        if (!stats) return null;

        const adjustment = match.ratingAdjustments.find((entry) => entry.playerID === playerID);
        const opponentIDs = new Set(stats.opponentIDs);
        const opponents = match.players.filter((player) => opponentIDs.has(player.id)).map((player) => player.username);

        const games = match.games.flatMap((game) => {
            const summary = this.gameSummary(game, playerID, opponentIDs);
            return summary ? [summary] : [];
        });

        const rankedMatchCosts = match.playerMatchStats
            .filter((entry) => Number.isFinite(entry.matchCost))
            .sort((a, b) => b.matchCost - a.matchCost);

        const matchCostIndex = rankedMatchCosts.findIndex((entry) => entry.playerID === playerID);
        const matchCostPlacement = matchCostIndex >= 0 ? matchCostIndex + 1 : null;

        return {
            id: match.id,
            osuID: match.osuID,
            lazer: match.isLazer,
            name: match.name,
            tournament: match.tournament?.abbreviation ?? match.tournament?.name ?? null,

            startTime: match.startTime,
            won: stats.won,

            gamesWon: stats.gamesWon,
            gamesLost: stats.gamesLost,

            matchCost: stats.matchCost,
            matchCostPlacement: matchCostPlacement,
            matchCostParticipants: rankedMatchCosts.length,

            ratingDelta: adjustment?.ratingDelta ?? null,

            averageScore: stats.averageScore,
            averageAccuracy: stats.averageAccuracy,
            averageMisses: stats.averageMisses,
            averagePlacement: stats.averagePlacement,
            isTeamMatch: stats.teammateIDs.length > 0,

            opponents,
            games,
        };
    }

    private gameSummary(
        game: OtrMatchGameDto,
        playerID: number,
        opponentIDs: ReadonlySet<number>,
    ): OtrScoutGameDto | null {
        const playerScore = game.scores.find((score) => score.playerID === playerID);

        if (!playerScore) return null;

        const opponents = game.scores.filter((score) => opponentIDs.has(score.playerID));
        const opponentAverageScore = opponents.length
            ? opponents.reduce((sum, score) => sum + score.score, 0) / opponents.length
            : null;

        const opponentBestScore = opponents.length ? Math.max(...opponents.map((score) => score.score)) : null;
        const opponentScoreDelta =
            opponentAverageScore && opponentAverageScore > 0
                ? (playerScore.score - opponentAverageScore) / opponentAverageScore
                : null;

        const opponentsOutscored = opponents.filter((score) => playerScore.score > score.score).length;

        return {
            id: game.id,

            beatmapOsuID: game.beatmap?.osuID ?? null,
            artist: game.beatmap?.beatmapset?.artist ?? null,
            title: game.beatmap?.beatmapset?.title ?? null,
            difficulty: game.beatmap?.diffName ?? null,

            score: playerScore.score,
            placement: playerScore.placement,
            accuracy: playerScore.accuracy,
            misses: playerScore.statMiss,

            mods: playerScore.mods,
            isFreeMod: game.isFreeMod,

            starRating: game.beatmap?.sr ?? null,

            opponentCount: opponents.length,
            opponentAverageScore,
            opponentBestScore,
            opponentScoreDelta,
            opponentsOutscored,
        };
    }

    private eventSummary(event: OtrTournamentDetailDto, playerID: number): OtrScoutEventDto | null {
        const stats = event.playerTournamentStats.find((entry) => entry.playerID === playerID);
        if (!stats) return null;

        return {
            id: event.id,
            forumUrl: event.forumUrl,
            name: event.name,
            abbreviation: event.abbreviation,
            startTime: event.startTime,
            matchesPlayed: stats.matchesPlayed,
            matchesWon: stats.matchesWon,
            matchesLost: stats.matchesLost,
            gamesPlayed: stats.gamesPlayed,
            gamesWon: stats.gamesWon,
            gamesLost: stats.gamesLost,
            averageMatchCost: stats.averageMatchCost,
            ratingBefore: stats.ratingBefore,
            ratingAfter: stats.ratingAfter,
        };
    }

    //#endregion
}
