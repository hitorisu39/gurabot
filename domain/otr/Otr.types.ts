import { GameMode } from "@generated/adapter/types";
import { EOtrKeyType, EOtrRuleset } from "./enums/Otr.enum";

export type TOtrTier =
    | "bronze"
    | "silver"
    | "gold"
    | "platinum"
    | "emerald"
    | "diamond"
    | "master"
    | "grandmaster"
    | "eliteGrandmaster";

export interface IOtrPlayerStatsQuery {
    mode?: GameMode;

    /**
     * Inclusive calendar dates
     */
    dateMin?: Date;
    dateMax?: Date;
}

export interface IOtrPlayerTournamentsQuery {
    mode?: GameMode;
    dateMin?: Date;
    dateMax?: Date;
}

export interface IOtrLeaderboardQuery {
    page?: number;
    pageSize?: number;

    mode?: GameMode;
    ruleset?: EOtrRuleset;
    country?: string;

    minOsuRank?: number;
    maxOsuRank?: number;

    minRating?: number;
    maxRating?: number;

    minMatches?: number;
    maxMatches?: number;

    minWinRate?: number;
    maxWinRate?: number;

    tiers?: Array<TOtrTier>;
}

export interface IOtrTournamentListQuery {
    page?: number;
    pageSize?: number;

    verified?: boolean;
    searchQuery?: string;

    ruleset?: EOtrRuleset;

    dateMin?: Date;
    dateMax?: Date;

    lobbySize?: Array<number>;

    minRankRange?: number;
    maxRankRange?: number;

    descending?: boolean;
}

export type TOtrBeatmapSort =
    | "sr"
    | "bpm"
    | "cs"
    | "ar"
    | "od"
    | "hp"
    | "length"
    | "tournamentCount"
    | "gameCount"
    | "creator";

export interface IOtrBeatmapListQuery {
    page?: number;
    pageSize?: number;

    searchQuery?: string;
    ruleset?: EOtrRuleset;

    minSr?: number;
    maxSr?: number;

    minBpm?: number;
    maxBpm?: number;

    minCs?: number;
    maxCs?: number;

    minAr?: number;
    maxAr?: number;

    minOd?: number;
    maxOd?: number;

    minHp?: number;
    maxHp?: number;

    minLength?: number;
    maxLength?: number;

    minGameCount?: number;
    maxGameCount?: number;

    minTournamentCount?: number;
    maxTournamentCount?: number;

    sort?: TOtrBeatmapSort;
    descending?: boolean;
}

export interface IOtrPlayerMatchesQuery {
    mode?: GameMode;
    opponentID?: number | string;
    opponentKeyType?: EOtrKeyType;
    dateMin?: Date;
    dateMax?: Date;
}
