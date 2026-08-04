import { Field, Mapping, SchemaProvider } from "../builder";
import { Beatmap, Beatmapset } from "../models/beatmap";
import { GameMode, Genre, Grade, Language, Status } from "../models/common";
import { Score } from "../models/score";
import { User } from "../models/user";

//#region Transformers

// Grades
const gradeToInstance: Record<string, string> = {
    XH: Grade.SSH,
    X: Grade.SS,
    SH: Grade.SH,
    S: Grade.S,
    A: Grade.A,
    B: Grade.B,
    C: Grade.C,
    D: Grade.D,
    F: Grade.F,
};

// Genre
const genreToInstance = [
    Genre.Any,
    Genre.Unspecified,
    Genre.VideoGame,
    Genre.Anime,
    Genre.Rock,
    Genre.Pop,
    Genre.Other,
    Genre.Novelty,
    Genre.HipHop,
    Genre.Electronic,
    Genre.Metal,
    Genre.Classical,
    Genre.Folk,
    Genre.Jazz,
];

// Language
const languageToInstance = [
    Language.Any,
    Language.Other,
    Language.English,
    Language.Japanese,
    Language.Chinese,
    Language.Instrumental,
    Language.Korean,
    Language.French,
    Language.German,
    Language.Swedish,
    Language.Spanish,
    Language.Italian,
    Language.Russian,
    Language.Polish,
    Language.Unspecified,
];

// Status
const statusToInstance: Record<string, string> = {
    ranked: Status.Ranked,
    graveyard: Status.Graveyard,
    loved: Status.Loved,
    approved: Status.Approved,
    pending: Status.Pending,
    wip: Status.WIP,
    qualified: Status.Qualified,
};

// GameMode
const modeToInstance: Record<string, string> = {
    osu: GameMode.Standard,
    taiko: GameMode.Taiko,
    fruits: GameMode.Catch,
    mania: GameMode.Mania,
};

const modeToPlain: Record<string, string> = {
    [GameMode.Standard]: "osu",
    [GameMode.Taiko]: "taiko",
    [GameMode.Catch]: "fruits",
    [GameMode.Mania]: "mania",
};

//#endregion

//#region Mappings

const UserMapping: Mapping = {
    id: "id",
    username: "username",
    previousUsernames: "previous_usernames",
    countryCode: "country_code",
    avatarUrl: "avatar_url",
    followers: "follower_count",
    mappingFollowers: "mapping_follower_count",

    joinDate: "join_date",
    lastVisit: "last_visit",
    online: "is_online",

    highestRank: {
        path: "rank_highest",
        nested: {
            rank: "rank",
            updatedAt: "updated_at",
        },
    },

    dailyChallenge: {
        path: "daily_challenge_user_stats",
        nested: {
            dailyStreakBest: "daily_streak_best",
            dailyStreakCurrent: "daily_streak_current",
            lastUpdate: "last_update",
            lastWeeklyStreak: "last_weekly_streak",
            playcount: "playcount",
            weeklyStreakBest: "weekly_streak_best",
            weeklyStreakCurrent: "weekly_streak_current",
            top10p: "top_10p_placements",
            top50p: "top_50p_placements",
        },
    },

    monthlyPlaycounts: {
        path: "monthly_playcounts",
        nested: {
            startDate: "start_date",
            count: "count",
        },
    },

    replaysWatchedCounts: {
        path: "replays_watched_counts",
        nested: {
            startDate: "start_date",
            count: "count",
        },
    },

    rankHistory: "rank_history",
    achievements: {
        path: "user_achievements",
        nested: {
            achievedAt: "achieved_at",
            achievementID: "achievement_id",
        },
    },

    badges: {
        path: "badges",
        nested: {
            awardedAt: "awarded_at",
            description: "description",
            imageUrl: "image_url",
            imageDoubleUrl: "image@2x_url",
            url: "url",
        },
    },

    statistics: {
        path: "statistics",
        nested: {
            count100: "count_100",
            count300: "count_300",
            count50: "count_50",
            countMiss: "count_miss",
            level: "level",
            globalRank: "global_rank",
            countryRank: "country_rank",
            pp: "pp",
            rankedScore: "ranked_score",
            accuracy: "hit_accuracy",
            playcount: "play_count",
            playtime: "play_time",
            totalScore: "total_score",
            totalHits: "total_hits",
            maxCombo: "maximum_combo",
            replaysWatched: "replays_watched_by_others",
            grades: "grade_counts",
        },
    },

    team: {
        path: "team",
        nested: {
            flagUrl: "flag_url",
            id: "id",
            name: "name",
            shortName: "short_name",
        },
    },

    scoresBestCount: "scores_best_count",
    scoresFirstCount: "scores_first_count",
    scoresPinnedCount: "scores_pinned_count",
    scoresRecentCount: "scores_recent_count",

    beatmapsetPendingCount: "pending_beatmapset_count",
    beatmapsetRankedCount: "ranked_beatmapset_count",
    beatmapsetNominatedCount: "nominated_beatmapset_count",
    beatmapsetGraveyardCount: "graveyard_beatmapset_count",
    beatmapsetLovedCount: "loved_beatmapset_count",
    beatmapsetGuestCount: "guest_beatmapset_count",

    beatmapsetFavoriteCount: "favourite_beatmapset_count",
};

const StatisticsMapping: Mapping = {
    ignoreMiss: {
        path: "ignore_miss",
        default: 0,
    },
    ignoreHit: {
        path: "ignore_hit",
        default: 0,
    },
    miss: {
        path: "miss",
        default: 0,
    },
    meh: {
        path: "meh",
        default: 0,
    },
    ok: {
        path: "ok",
        default: 0,
    },
    good: {
        path: "good",
        default: 0,
    },
    great: {
        path: "great",
        default: 0,
    },
    perfect: {
        path: "perfect",
        default: 0,
    },
    smallTickMiss: {
        path: "small_tick_miss",
        default: 0,
    },
    smallTickHit: {
        path: "small_tick_hit",
        default: 0,
    },
    largeTickMiss: {
        path: "large_tick_miss",
        default: 0,
    },
    largeTickHit: {
        path: "large_tick_hit",
        default: 0,
    },
    smallBonus: {
        path: "small_bonus",
        default: 0,
    },
    largeBonus: {
        path: "large_bonus",
        default: 0,
    },
    legacyComboIncrease: {
        path: "legacy_combo_increase",
        default: 0,
    },
};

const CoverMapping: Mapping = {
    cover: "cover",
    coverDouble: "cover@2x",
    card: "card",
    cardDouble: "card@2x",
    list: "list",
    listDouble: "list@2x",
    slimcover: "slimcover",
    slimcoverDouble: "slimcover@2x",
};

const OwnersMapping: Mapping = {
    id: "id",
    username: "username",
};

const BeatmapsetMapping: Mapping = {
    id: "id",
    artist: "artist",
    animeCover: "anime_cover",
    creator: "creator",
    nsfw: "nsfw",
    offset: "offset",
    video: "video",
    source: "source",
    spotlight: "spotlight",
    playcount: "play_count",
    title: "title",
    artistUnicode: "artist_unicode",
    covers: {
        path: "covers",
        nested: CoverMapping,
    },
    favoriteCount: "favourite_count",
    genre: {
        path: "genre_id",
        transform: (v) => genreToInstance[v],
    },
    language: {
        path: "language_id",
        transform: (v) => languageToInstance[v],
    },
    previewUrl: "preview_url",
    status: {
        path: "status",
        transform: (v) => statusToInstance[v],
    },
    titleUnicode: "title_unicode",
    userID: "user_id",
    rankedDate: "ranked_date",
    submittedDate: "submitted_date",
    tags: "tags",
};

const BeatmapMapping: Mapping = {
    id: "id",
    version: "version",
    difficulty: "difficulty_rating",
    beatmapsetID: "beatmapset_id",
    mode: {
        path: "mode",
        transform: (v) => modeToInstance[v],
    },
    status: {
        path: "status",
        transform: (v) => statusToInstance[v],
    },
    totalLength: "total_length",
    hitLength: "hit_length",
    userID: "user_id",
    ar: "ar",
    cs: "cs",
    od: "accuracy",
    hp: "drain",
    bpm: "bpm",
    countCircles: "count_circles",
    countSliders: "count_sliders",
    countSpinners: "count_spinners",
    lastUpdated: "last_updated",
    passcount: "passcount",
    playcount: "playcount",
    checksum: "checksum",
    ranked: "ranked",
    convert: "convert",
    url: "url",
    owners: {
        path: "owners",
        nested: OwnersMapping,
    },
    beatmapset: {
        path: "beatmapset",
        nested: BeatmapsetMapping,
    },
};

BeatmapsetMapping.beatmaps = {
    path: "beatmaps",
    nested: BeatmapMapping,
};

const ScoreMapping: Mapping = {
    id: "id",
    index: "$index",
    preserve: "preserve",
    processed: "processed",
    ranked: "ranked",
    type: "type",
    accuracy: "accuracy",
    endedAt: "ended_at",
    replay: "replay",
    pp: "pp",
    legacyPerfect: "legacy_perfect",
    legacyScoreID: "legacy_score_id",
    legacyTotalScore: "legacy_total_score",
    passed: "passed",
    classicTotalScore: "classic_total_score",
    maximumStatistics: {
        path: "maximum_statistics",
        nested: StatisticsMapping,
    },
    mods: "mods",
    statistics: {
        path: "statistics",
        nested: StatisticsMapping,
    },
    beatmapID: "beatmap_id",
    bestID: "best_id",
    grade: {
        path: "rank",
        transform: (v) => gradeToInstance[v],
    },
    userID: "user_id",
    perfect: "is_perfect_combo",
    maxCombo: "max_combo",
    totalScore: "total_score",
    attributes: {
        path: "current_user_attributes",
        nested: {
            pinned: "pin",
        },
    },
    beatmap: {
        path: "beatmap",
        nested: BeatmapMapping,
    },
    beatmapset: {
        path: "beatmapset",
        nested: BeatmapsetMapping,
    },
    weight: "weight",
};

//#endregion

export const OsuProvider = SchemaProvider.define("osu", {
    name: "Bancho", // Easier to distinguish as a Discord option
    base: "https://osu.ppy.sh/api/v2",
    domain: "https://osu.ppy.sh",
    cache: true,
    display: false,
    transforms: {
        [GameMode.$name]: {
            toPlain: (v) => modeToPlain[v],
            toInstance: (v) => modeToInstance[v],
        },
    },
    formatters: {
        userProfile: (id, mode) => {
            const modeStr = mode ? modeToPlain[mode] : "";
            return `https://osu.ppy.sh/users/${id}${modeStr ? `/${modeStr}` : ""}`;
        },
        userAvatar: (id, timestamp) => {
            const time = timestamp ?? Date.now();
            return `https://a.ppy.sh/${id}?timestamp=${time}`;
        },
    },
    endpoints: {
        user: {
            args: {
                id: Field.Int().Optional(),
                username: Field.String().Optional(),
                mode: Field.Enum(GameMode),
            },
            path: (args) => {
                const userIdentifier = args.id ? args.id : `@${args.username}`;
                return `/users/${userIdentifier}/${args.mode}`;
            },
            method: "GET",
            returns: User,
            mapping: UserMapping,
        },
        best: {
            args: {
                id: Field.Int(),
                mode: Field.Enum(GameMode),
                limit: Field.Int(),
                offset: Field.Int().Optional(),
                legacyOnly: Field.Boolean().Optional(),
            },
            path: (args) => {
                let options = `mode=${args.mode}&limit=${args.limit}`;
                if (args.offset) options += `&offset=${args.offset}`;
                if (args.legacyOnly) options += `&legacy_only=1`;
                return `/users/${args.id}/scores/best?${options}`;
            },
            method: "GET",
            returns: { model: Score, isArray: true },
            mapping: ScoreMapping,
        },
        recent: {
            args: {
                id: Field.Int(),
                mode: Field.Enum(GameMode),
                limit: Field.Int(),
                includeFails: Field.Boolean().Optional(),
            },
            path: (args) => {
                let options = `mode=${args.mode}&limit=${args.limit}`;
                if (args.includeFails) options += `&include_fails=1`;
                return `/users/${args.id}/scores/recent?${options}`;
            },
            method: "GET",
            returns: { model: Score, isArray: true },
            mapping: ScoreMapping,
        },
        beatmap: {
            args: {
                id: Field.Int(),
            },
            path: (args) => `/beatmaps/${args.id}`,
            method: "GET",
            returns: Beatmap,
            mapping: BeatmapMapping,
        },
        beatmaps: {
            args: {
                ids: Field.Int().Array(),
            },
            path: (args) => `/beatmaps?${args.ids.map((id: number) => `ids[]=${id}`).join("&")}`,
            method: "GET",
            returns: { model: Beatmap, isArray: true, dataPath: "beatmaps" },
            mapping: BeatmapMapping,
        },
        beatmapset: {
            args: {
                id: Field.Int(),
            },
            path: (args) => `/beatmapsets/${args.id}`,
            method: "GET",
            returns: Beatmapset,
            mapping: BeatmapsetMapping,
        },
        user_beatmap_scores: {
            args: {
                id: Field.Int(),
                mode: Field.Enum(GameMode),
                beatmapID: Field.Int(),
                legacyOnly: Field.Boolean().Optional(),
            },
            path: (args) => {
                let options = `mode=${args.mode}`;
                if (args.legacyOnly) options += `&legacy_only=1`;
                return `/beatmaps/${args.beatmapID}/scores/users/${args.id}/all?${options}`;
            },
            method: "GET",
            returns: { model: Score, isArray: true, dataPath: "scores" },
            mapping: ScoreMapping,
        },
        beatmap_scores: {
            args: {
                beatmapID: Field.Int(),
                mode: Field.Enum(GameMode),
                mods: Field.Mods().Optional(),
                legacyOnly: Field.Boolean().Optional(),
            },
            path: (args) => {
                const params = new URLSearchParams({
                    mode: args.mode,
                });

                for (const acronym of args.mods ?? []) {
                    params.append("mods[]", acronym);
                }

                if (args.legacyOnly) {
                    params.set("legacy_only", "1");
                }

                return `/beatmaps/${args.beatmapID}/scores?${params.toString()}`;
            },
            method: "GET",
            returns: {
                model: Score,
                isArray: true,
                dataPath: "scores",
            },
            mapping: ScoreMapping,
        },
    },
});
