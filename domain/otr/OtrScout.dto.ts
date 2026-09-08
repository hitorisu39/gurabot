import { Exclude, Expose, Type } from "class-transformer";

@Exclude()
export class OtrScoutGameDto {
    @Expose()
    declare id: number;

    @Expose()
    declare beatmapOsuID: number | null;

    @Expose()
    declare artist: string | null;

    @Expose()
    declare title: string | null;

    @Expose()
    declare difficulty: string | null;

    @Expose()
    declare score: number;

    @Expose()
    declare placement: number;

    @Expose()
    declare accuracy: number;

    @Expose()
    declare misses: number | null;

    @Expose()
    declare opponentCount: number;

    @Expose()
    declare opponentAverageScore: number | null;

    @Expose()
    declare opponentBestScore: number | null;

    @Expose()
    declare starRating: number | null;

    @Expose()
    declare mods: number;

    @Expose()
    declare isFreeMod: boolean;

    /**
     * Percentage difference from the average opponent score.
     *
     * 0.08 = 8% above opponent average.
     */
    @Expose()
    declare opponentScoreDelta: number | null;

    @Expose()
    declare opponentsOutscored: number;
}

@Exclude()
export class OtrScoutMatchDto {
    @Expose()
    declare id: number;

    @Expose()
    declare osuID: number;

    @Expose()
    declare lazer: boolean;

    @Expose()
    declare name: string;

    @Expose()
    declare tournament: string | null;

    @Expose()
    @Type(() => Date)
    declare startTime: Date | null;

    @Expose()
    declare won: boolean;

    @Expose()
    declare gamesWon: number;

    @Expose()
    declare gamesLost: number;

    @Expose()
    declare matchCost: number;

    @Expose()
    declare matchCostPlacement: number | null;

    @Expose()
    declare matchCostParticipants: number;

    @Expose()
    declare ratingDelta: number | null;

    @Expose()
    declare averageScore: number;

    @Expose()
    declare averageAccuracy: number;

    @Expose()
    declare averageMisses: number;

    @Expose()
    declare averagePlacement: number;

    @Expose()
    declare opponents: Array<string>;

    @Expose()
    declare isTeamMatch: boolean;

    @Expose()
    @Type(() => OtrScoutGameDto)
    declare games: Array<OtrScoutGameDto>;
}

@Exclude()
export class OtrScoutEventDto {
    @Expose()
    declare id: number;

    @Expose()
    declare name: string;

    @Expose()
    declare forumUrl: string;

    @Expose()
    declare abbreviation: string;

    @Expose()
    @Type(() => Date)
    declare startTime: Date | null;

    @Expose()
    declare matchesPlayed: number;

    @Expose()
    declare matchesWon: number;

    @Expose()
    declare matchesLost: number;

    @Expose()
    declare gamesPlayed: number;

    @Expose()
    declare gamesWon: number;

    @Expose()
    declare gamesLost: number;

    @Expose()
    declare averageMatchCost: number;

    @Expose()
    declare ratingBefore: number;

    @Expose()
    declare ratingAfter: number;
}

@Exclude()
export class OtrScoutModSummaryDto {
    @Expose()
    declare label: string;

    @Expose()
    declare games: number;

    @Expose()
    declare averageOpponentDelta: number | null;

    @Expose()
    declare aboveOpponentAverage: number;

    @Expose()
    declare topVsOpponents: number;

    @Expose()
    declare averagePlacement: number;

    @Expose()
    declare averageAccuracy: number;

    @Expose()
    declare averageMisses: number;
}
