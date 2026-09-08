import { EOtrKeyType, EOtrRuleset } from "@domain/otr/enums/Otr.enum";
import { OtrPlayerDto, OtrPlayerRatingDto, OtrPlayerStatsDto, OtrPlayerTournamentDto } from "@domain/otr/OtrPlayer.dto";
import { IOtrLeaderboardQuery, IOtrPlayerStatsQuery, IOtrPlayerTournamentsQuery } from "@domain/otr/Otr.types";
import { OtrPlayerService } from "./OtrPlayer.service";
import { AbstractService } from "@/core/framework/AbstractService";
import { Import } from "@/core/decorators";
import { OtrTournamentDetailDto } from "@domain/otr/OtrTournament.dto";
import { OtrMatchDetailDto } from "@domain/otr/OtrMatch.dto";
import { OtrTournamentService } from "./OtrTournament.service";
import { OtrMatchService } from "./OtrMatch.service";
import { OtrLeaderboardService } from "./OtrLeaderboard.service";
import { OtrLeaderboardPageDto } from "@domain/otr/OtrLeaderboard.dto";
import { OtrBeatmapStatsDto } from "@domain/otr/OtrBeatmap.dto";
import { OtrBeatmapService } from "./OtrBeatmap.service";

export class OtrService extends AbstractService {
    @Import() declare private readonly playerService: OtrPlayerService;
    @Import() declare private readonly tournamentService: OtrTournamentService;
    @Import() declare private readonly matchService: OtrMatchService;
    @Import() declare private readonly leaderboardService: OtrLeaderboardService;
    @Import() declare private readonly beatmapService: OtrBeatmapService;

    public player(osuID: number): Promise<OtrPlayerDto> {
        return this.playerService.get(osuID, EOtrKeyType.Osu);
    }

    public playerByUsername(username: string): Promise<OtrPlayerDto> {
        return this.playerService.get(username, EOtrKeyType.Username);
    }

    public playerByOtrID(otrID: number): Promise<OtrPlayerDto> {
        return this.playerService.get(otrID, EOtrKeyType.Otr);
    }

    public playerStats(osuID: number, query: IOtrPlayerStatsQuery = {}): Promise<OtrPlayerStatsDto> {
        return this.playerService.stats(osuID, EOtrKeyType.Osu, query);
    }

    public playerStatsByUsername(username: string, query: IOtrPlayerStatsQuery = {}): Promise<OtrPlayerStatsDto> {
        return this.playerService.stats(username, EOtrKeyType.Username, query);
    }

    public playerStatsByOtrID(otrID: number, query: IOtrPlayerStatsQuery = {}): Promise<OtrPlayerStatsDto> {
        return this.playerService.stats(otrID, EOtrKeyType.Otr, query);
    }

    public playerTournaments(
        osuID: number,
        query: IOtrPlayerTournamentsQuery = {},
    ): Promise<Array<OtrPlayerTournamentDto>> {
        return this.playerService.tournaments(osuID, EOtrKeyType.Osu, query);
    }

    public playerTournamentsByUsername(
        username: string,
        query: IOtrPlayerTournamentsQuery = {},
    ): Promise<Array<OtrPlayerTournamentDto>> {
        return this.playerService.tournaments(username, EOtrKeyType.Username, query);
    }

    public playerTournamentsByOtrID(
        otrID: number,
        query: IOtrPlayerTournamentsQuery = {},
    ): Promise<Array<OtrPlayerTournamentDto>> {
        return this.playerService.tournaments(otrID, EOtrKeyType.Otr, query);
    }

    public playerRatings(osuIDs: ReadonlyArray<number>, ruleset: EOtrRuleset): Promise<Array<OtrPlayerRatingDto>> {
        return this.playerService.ratings(osuIDs, ruleset);
    }

    public tournament(id: number): Promise<OtrTournamentDetailDto> {
        return this.tournamentService.get(id);
    }

    public match(id: number): Promise<OtrMatchDetailDto> {
        return this.matchService.get(id, EOtrKeyType.Otr);
    }

    public matchByOsuID(osuID: number): Promise<OtrMatchDetailDto> {
        return this.matchService.get(osuID, EOtrKeyType.Osu);
    }

    public leaderboard(query: IOtrLeaderboardQuery = {}): Promise<OtrLeaderboardPageDto> {
        return this.leaderboardService.list(query);
    }

    public beatmapStats(osuID: number): Promise<OtrBeatmapStatsDto> {
        return this.beatmapService.stats(osuID);
    }
}
