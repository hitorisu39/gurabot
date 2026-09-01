import {
    BeatmapSearchExtra,
    BeatmapSearchGeneral,
    BeatmapSearchPlayed,
    BeatmapSearchRank,
    BeatmapSearchSortField,
    BeatmapSearchSortOrder,
    BeatmapSearchStatus,
    GameMode,
    Genre,
    Language,
} from "@generated/adapter/types";

export type UserScoreType = "best" | "recent" | "firsts" | "pinned";

export interface IBeatmapsetSearchInput {
    query?: string;
    mode?: GameMode;
    status?: BeatmapSearchStatus;
    genre?: Genre;
    language?: Language;
    extras?: Array<BeatmapSearchExtra>;
    general?: Array<BeatmapSearchGeneral>;
    nsfw?: boolean;
    played?: BeatmapSearchPlayed;
    ranks?: Array<BeatmapSearchRank>;
    sort?: {
        field: BeatmapSearchSortField;
        order?: BeatmapSearchSortOrder;
    };
    cursorString?: string;
    // Legacy
    page?: number;
}

export interface IMultiplayerEventsOptions {
    limit?: number;
    before?: number;
    after?: number;
}
