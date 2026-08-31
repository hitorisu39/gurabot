import { Field, Mapping, SchemaProvider } from "../builder";
import { booleanFromLegacy, clamp, isRecord, nonNegativeInteger, numberOrUndefined, numberOrZero } from "../utils";
import { AccuracyStatistics, calculateAccuracy, calculateScoreWeight, normalizeAccuracy } from "../osu/utils";
import { GameMode, Grade } from "../models/common";
import { Score } from "../models/score";
import { User } from "../models/user";

type AnyRecord = Record<string, any>;
type AkatsukiVariant = 0 | 1 | 2;
type ModernScoreEndpoint = "best" | "recent";

interface AkatsukiProviderOptions {
    id: string;
    name: string;
    variant: AkatsukiVariant;
}

interface NormalizedScoreStatistics extends AccuracyStatistics {
    slider_tail_hit: number;
    ignore_miss: number;
    ignore_hit: number;
    small_tick_miss: number;
    small_tick_hit: number;
    large_tick_miss: number;
    large_tick_hit: number;
    small_bonus: number;
    large_bonus: number;
    legacy_combo_increase: number;
}

//#region Transforms

const modeToPlain: Record<string, number> = {
    [GameMode.Standard]: 0,
    [GameMode.Taiko]: 1,
    [GameMode.Catch]: 2,
    [GameMode.Mania]: 3,
};

const modeToInstance: Record<number, string> = {
    0: GameMode.Standard,
    1: GameMode.Taiko,
    2: GameMode.Catch,
    3: GameMode.Mania,
};

const modeToStatisticsKey: Record<number, "std" | "taiko" | "ctb" | "mania"> = {
    0: "std",
    1: "taiko",
    2: "ctb",
    3: "mania",
};

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

//#endregion

//#region Akatsuki-specific helpers

function normalizeAkatsukiDate(value: unknown): unknown {
    if (typeof value !== "string") {
        return value;
    }

    if (/Z$|[+-]\d{2}:\d{2}$/.test(value)) {
        return value;
    }

    return `${value.replace(" ", "T")}Z`;
}

function assertSuccessfulResponse(data: AnyRecord, endpointName: string): void {
    if (data.code === undefined || Number(data.code) === 200) {
        return;
    }

    throw new Error(`Akatsuki endpoint "${endpointName}" returned API code ${data.code}.`);
}

function applyVariant(params: URLSearchParams, variant: AkatsukiVariant): void {
    if (variant !== 0) {
        params.set("rx", String(variant));
    }
}

//#endregion

//#region User normalization

function createUserResponseNormalizer(variant: AkatsukiVariant) {
    return (data: unknown, args: AnyRecord): unknown => {
        if (!isRecord(data)) {
            return data;
        }

        const raw = data as AnyRecord;
        assertSuccessfulResponse(raw, "user");

        const mode = numberOrZero(args.mode);
        const modeKey = modeToStatisticsKey[mode] ?? "std";

        const sourceStatistics = raw.stats?.[variant]?.[modeKey] ?? {};
        const sourceGrades = sourceStatistics.grades ?? {};

        const rawLevel = numberOrZero(sourceStatistics.level);
        const currentLevel = Math.floor(rawLevel);

        const levelProgress = clamp(Math.floor((rawLevel - currentLevel) * 100), 0, 100);

        const previousUsernames =
            typeof raw.username_aka === "string" && raw.username_aka.trim().length > 0 ? [raw.username_aka.trim()] : [];

        const normalizedTeam = raw.clan?.id
            ? {
                  flag_url: typeof raw.clan.icon === "string" ? raw.clan.icon : "",
                  id: numberOrZero(raw.clan.id),
                  name: typeof raw.clan.name === "string" ? raw.clan.name : "",
                  short_name: typeof raw.clan.tag === "string" ? raw.clan.tag : "",
              }
            : undefined;

        return {
            ...raw,

            previous_usernames: previousUsernames,
            country_code: typeof raw.country === "string" ? raw.country : "",
            avatar_url: `https://a.akatsuki.gg/${raw.id}`,
            join_date: raw.registered_on,
            last_visit: raw.latest_activity,
            normalized_team: normalizedTeam,

            selected_statistics: {
                count_100: 0,
                count_300: 0,
                count_50: 0,
                count_miss: 0,

                level: {
                    current: currentLevel,
                    progress: levelProgress,
                },

                global_leaderboard_rank: numberOrZero(sourceStatistics.global_leaderboard_rank),
                country_leaderboard_rank: numberOrZero(sourceStatistics.country_leaderboard_rank),

                pp: numberOrZero(sourceStatistics.pp),
                ranked_score: numberOrZero(sourceStatistics.ranked_score),
                accuracy: numberOrZero(sourceStatistics.accuracy),
                playcount: numberOrZero(sourceStatistics.playcount),
                playtime: numberOrZero(sourceStatistics.playtime),
                total_score: numberOrZero(sourceStatistics.total_score),
                total_hits: numberOrZero(sourceStatistics.total_hits),
                max_combo: numberOrZero(sourceStatistics.max_combo),
                replays_watched: numberOrZero(sourceStatistics.replays_watched),

                grades: {
                    xh_count: numberOrZero(sourceGrades.xh_count),
                    x_count: numberOrZero(sourceGrades.x_count),
                    sh_count: numberOrZero(sourceGrades.sh_count),
                    s_count: numberOrZero(sourceGrades.s_count),
                    a_count: numberOrZero(sourceGrades.a_count),
                },
            },
        };
    };
}

//#endregion

//#region Score normalization

function normalizeStatistics(raw: AnyRecord): NormalizedScoreStatistics {
    return {
        slider_tail_hit: 0,
        ignore_miss: 0,
        ignore_hit: 0,

        miss: numberOrZero(raw.count_miss),
        meh: numberOrZero(raw.count_50),
        ok: numberOrZero(raw.count_100),
        good: numberOrZero(raw.count_katu),
        great: numberOrZero(raw.count_300),
        perfect: numberOrZero(raw.count_geki),

        small_tick_miss: 0,
        small_tick_hit: 0,
        large_tick_miss: 0,
        large_tick_hit: 0,
        small_bonus: 0,
        large_bonus: 0,
        legacy_combo_increase: 0,
    };
}

function createFallbackWeight(pp: number | undefined): AnyRecord {
    return {
        percentage: 100,
        pp: pp ?? 0,
    };
}

function normalizeModernScore(
    raw: AnyRecord,
    args: AnyRecord,
    endpoint: ModernScoreEndpoint,
    absoluteIndex: number,
): AnyRecord {
    const mode = numberOrZero(raw.play_mode ?? args.mode);
    const statistics = normalizeStatistics(raw);
    const pp = numberOrUndefined(raw.pp);

    const accuracy = normalizeAccuracy(raw.accuracy) ?? calculateAccuracy(mode, statistics);
    const weight = endpoint === "best" ? calculateScoreWeight(pp ?? 0, absoluteIndex) : createFallbackWeight(pp);

    return {
        id: numberOrZero(raw.id),

        classic_total_score: numberOrZero(raw.score),
        total_score: numberOrZero(raw.score),

        mods: numberOrZero(raw.mods),
        statistics,

        beatmap_id: numberOrZero(raw.beatmap?.beatmap_id),
        rank: raw.rank,
        user_id: numberOrZero(raw.user_id),

        accuracy,
        ended_at: normalizeAkatsukiDate(raw.time),

        replay: false,
        is_perfect_combo: Boolean(raw.full_combo),
        max_combo: numberOrZero(raw.max_combo),
        passed: Number(raw.completed) === 3,

        ...(pp !== undefined ? { pp } : {}),

        current_user_attributes: {
            pin: Boolean(raw.pinned),
        },

        weight,
    };
}

function createModernScoresResponseNormalizer(endpoint: ModernScoreEndpoint) {
    return (data: unknown, args: AnyRecord): unknown => {
        if (!isRecord(data)) {
            return data;
        }

        const raw = data as AnyRecord;

        assertSuccessfulResponse(raw, endpoint);

        const requestedLimit = nonNegativeInteger(args.limit);
        const offset = endpoint === "best" ? nonNegativeInteger(args.offset) : 0;

        let scores: AnyRecord[] = Array.isArray(raw.scores) ? raw.scores : [];

        if (endpoint === "recent" && !args.includeFails) {
            scores = scores.filter((score) => Number(score.completed) === 3);
        }

        if (endpoint === "best" && offset > 0) {
            scores = scores.slice(offset);
        }

        if (requestedLimit > 0) {
            scores = scores.slice(0, requestedLimit);
        }

        return {
            ...raw,

            scores: scores.map((score, index) => normalizeModernScore(score, args, endpoint, offset + index)),
        };
    };
}

function normalizeLegacyScore(raw: AnyRecord, args: AnyRecord): AnyRecord {
    const mode = numberOrZero(args.mode);

    const statistics = normalizeStatistics({
        count_miss: raw.countmiss,
        count_50: raw.count50,
        count_100: raw.count100,
        count_katu: raw.countkatu,
        count_300: raw.count300,
        count_geki: raw.countgeki,
    });

    const pp = numberOrUndefined(raw.pp);
    const accuracy = normalizeAccuracy(raw.accuracy) ?? calculateAccuracy(mode, statistics);

    return {
        id: numberOrZero(raw.score_id),

        classic_total_score: numberOrZero(raw.score),
        total_score: numberOrZero(raw.score),

        mods: numberOrZero(raw.enabled_mods),
        statistics,

        beatmap_id: numberOrZero(args.beatmapID),
        rank: raw.rank,
        user_id: numberOrZero(raw.user_id),

        accuracy,
        ended_at: normalizeAkatsukiDate(raw.date),

        replay: false,
        is_perfect_combo: booleanFromLegacy(raw.perfect),
        max_combo: numberOrZero(raw.maxcombo),

        passed: true,
        ...(pp !== undefined ? { pp } : {}),
        weight: createFallbackWeight(pp),
    };
}

function normalizeLegacyScoresResponse(data: unknown, args: AnyRecord): unknown {
    if (Array.isArray(data)) {
        return data.map((score) => normalizeLegacyScore(score as AnyRecord, args));
    }

    if (!isRecord(data)) {
        return [];
    }

    const raw = data as AnyRecord;

    assertSuccessfulResponse(raw, "get_scores");

    if (!Array.isArray(raw.scores)) {
        return [];
    }

    return raw.scores.map((score: AnyRecord) => normalizeLegacyScore(score, args));
}

//#endregion

//#region User mappings

const UserLevelMapping: Mapping = {
    current: {
        path: "current",
        default: 0,
    },
    progress: {
        path: "progress",
        default: 0,
    },
};

const UserGradesMapping: Mapping = {
    ss: {
        path: "x_count",
        default: 0,
    },
    ssh: {
        path: "xh_count",
        default: 0,
    },
    s: {
        path: "s_count",
        default: 0,
    },
    sh: {
        path: "sh_count",
        default: 0,
    },
    a: {
        path: "a_count",
        default: 0,
    },
};

const UserStatisticsMapping: Mapping = {
    count100: {
        path: "count_100",
        default: 0,
    },
    count300: {
        path: "count_300",
        default: 0,
    },
    count50: {
        path: "count_50",
        default: 0,
    },
    countMiss: {
        path: "count_miss",
        default: 0,
    },

    level: {
        path: "level",
        nested: UserLevelMapping,
    },

    globalRank: {
        path: "global_leaderboard_rank",
        default: 0,
    },
    countryRank: {
        path: "country_leaderboard_rank",
        default: 0,
    },

    pp: {
        path: "pp",
        default: 0,
    },
    rankedScore: {
        path: "ranked_score",
        default: 0,
    },
    accuracy: {
        path: "accuracy",
        default: 0,
    },
    playcount: {
        path: "playcount",
        default: 0,
    },
    playtime: {
        path: "playtime",
        default: 0,
    },
    totalScore: {
        path: "total_score",
        default: 0,
    },
    totalHits: {
        path: "total_hits",
        default: 0,
    },
    maxCombo: {
        path: "max_combo",
        default: 0,
    },
    replaysWatched: {
        path: "replays_watched",
        default: 0,
    },

    grades: {
        path: "grades",
        nested: UserGradesMapping,
    },
};

const UserMapping: Mapping = {
    id: "id",
    username: "username",

    previousUsernames: {
        path: "previous_usernames",
        default: [],
    },

    countryCode: {
        path: "country_code",
        default: "",
    },

    avatarUrl: "avatar_url",

    followers: {
        path: "followers",
        default: 0,
    },

    mappingFollowers: {
        default: 0,
    },

    joinDate: "join_date",
    lastVisit: "last_visit",

    statistics: {
        path: "selected_statistics",
        nested: UserStatisticsMapping,
    },

    team: {
        path: "normalized_team",

        nested: {
            flagUrl: {
                path: "flag_url",
                default: "",
            },
            id: {
                path: "id",
                default: 0,
            },
            name: {
                path: "name",
                default: "",
            },
            shortName: {
                path: "short_name",
                default: "",
            },
        },
    },

    scoresBestCount: {
        default: 0,
    },
    scoresFirstCount: {
        default: 0,
    },
    scoresPinnedCount: {
        default: 0,
    },
    scoresRecentCount: {
        default: 0,
    },

    beatmapsetPendingCount: {
        default: 0,
    },
    beatmapsetRankedCount: {
        default: 0,
    },
    beatmapsetNominatedCount: {
        default: 0,
    },
    beatmapsetGraveyardCount: {
        default: 0,
    },
    beatmapsetLovedCount: {
        default: 0,
    },
    beatmapsetGuestCount: {
        default: 0,
    },
    beatmapsetFavoriteCount: {
        default: 0,
    },
};

//#endregion

//#region Score mappings

const ScoreStatisticsMapping: Mapping = {
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

const ScoreWeightMapping: Mapping = {
    percentage: {
        path: "percentage",
        default: 100,
    },
    pp: {
        path: "pp",
        default: 0,
    },
};

const ScoreMapping: Mapping = {
    id: {
        path: "id",
        transform: () => null,
    },
    index: "$index",

    classicTotalScore: {
        path: "classic_total_score",
        default: 0,
    },

    mods: {
        path: "mods",
        default: 0,
    },

    statistics: {
        path: "statistics",
        nested: ScoreStatisticsMapping,
    },

    beatmapID: {
        path: "beatmap_id",
        default: 0,
    },

    grade: {
        path: "rank",
        transform: (value: unknown) => gradeToInstance[String(value).toUpperCase()] ?? Grade.F,
    },

    userID: {
        path: "user_id",
        default: 0,
    },

    accuracy: {
        path: "accuracy",
        default: 0,
    },

    endedAt: "ended_at",

    replay: {
        path: "replay",
        default: false,
    },

    perfect: {
        path: "is_perfect_combo",
        default: false,
    },

    maxCombo: {
        path: "max_combo",
        default: 0,
    },

    passed: {
        path: "passed",
        default: false,
    },

    pp: "pp",

    totalScore: {
        path: "total_score",
        default: 0,
    },

    attributes: {
        path: "current_user_attributes",

        nested: {
            pinned: {
                path: "pin",
                default: false,
            },
        },
    },

    weight: {
        path: "weight",
        nested: ScoreWeightMapping,
    },
};

//#endregion

//#region Provider factory

function createAkatsukiProvider(options: AkatsukiProviderOptions): SchemaProvider {
    const { id, name, variant } = options;

    return SchemaProvider.define(id, {
        name,
        base: "https://akatsuki.gg/api/v1",
        domain: "https://akatsuki.gg",
        accountProvider: "akatsuki",
        linkable: variant === 0,
        cache: false,
        display: true,

        transforms: {
            [GameMode.$name]: {
                toPlain: (value: unknown) => modeToPlain[String(value)] ?? 0,
                toInstance: (value: unknown) => modeToInstance[numberOrZero(value)] ?? GameMode.Standard,
            },
        },
        formatters: {
            userProfile: (userID, mode) => {
                const numericMode = mode ? (modeToPlain[mode] ?? 0) : 0;
                return `https://akatsuki.gg/u/${userID}?mode=${numericMode}&rx=${variant}`;
            },
            userAvatar: (userID) => `https://a.akatsuki.gg/${userID}`,
        },

        endpoints: {
            user: {
                args: {
                    id: Field.Int().Optional(),
                    username: Field.String().Optional(),
                    mode: Field.Enum(GameMode),
                },

                path: (args) => {
                    const params = new URLSearchParams();

                    if (args.id !== undefined && args.id !== null) {
                        params.set("id", String(args.id));
                    } else if (typeof args.username === "string" && args.username.trim()) {
                        params.set("name", args.username.trim());
                    } else {
                        throw new Error("Akatsuki user lookup requires either id or username.");
                    }

                    return `/users/full?${params.toString()}`;
                },

                method: "GET",
                returns: User,
                mapping: UserMapping,
                transformResponse: createUserResponseNormalizer(variant),
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
                    const offset = nonNegativeInteger(args.offset);
                    const limit = Math.max(1, nonNegativeInteger(args.limit));
                    const requestLimit = Math.min(100, limit + offset);

                    const params = new URLSearchParams({
                        id: String(args.id),
                        l: String(requestLimit),
                        mode: String(args.mode),
                    });

                    applyVariant(params, variant);

                    return `/users/scores/best?${params.toString()}`;
                },

                method: "GET",

                returns: {
                    model: Score,
                    isArray: true,
                    dataPath: "scores",
                },

                mapping: ScoreMapping,
                transformResponse: createModernScoresResponseNormalizer("best"),
            },

            recent: {
                args: {
                    id: Field.Int(),
                    mode: Field.Enum(GameMode),
                    limit: Field.Int(),
                    includeFails: Field.Boolean().Optional(),
                },

                path: (args) => {
                    const params = new URLSearchParams({
                        id: String(args.id),
                        l: String(Math.max(1, nonNegativeInteger(args.limit))),
                        mode: String(args.mode),
                    });

                    applyVariant(params, variant);

                    return `/users/scores/recent?${params.toString()}`;
                },

                method: "GET",

                returns: {
                    model: Score,
                    isArray: true,
                    dataPath: "scores",
                },

                mapping: ScoreMapping,
                transformResponse: createModernScoresResponseNormalizer("recent"),
            },

            user_beatmap_scores: {
                args: {
                    id: Field.Int(),
                    mode: Field.Enum(GameMode),
                    beatmapID: Field.Int(),
                    legacyOnly: Field.Boolean().Optional(),
                },

                path: (args) => {
                    const params = new URLSearchParams({
                        b: String(args.beatmapID),
                        u: String(args.id),
                        m: String(args.mode),
                    });

                    applyVariant(params, variant);

                    return `/get_scores?${params.toString()}`;
                },

                method: "GET",

                returns: {
                    model: Score,
                    isArray: true,
                },

                mapping: ScoreMapping,
                transformResponse: normalizeLegacyScoresResponse,
            },

            beatmap_scores: {
                args: {
                    beatmapID: Field.Int(),
                    mode: Field.Enum(GameMode),
                    mods: Field.Mods().Optional(),
                    legacyOnly: Field.Boolean().Optional(),
                },

                path: (args) => {
                    if (Array.isArray(args.mods) && args.mods.length > 0) {
                        throw new Error("Akatsuki beatmap scores do not support mod filtering.");
                    }

                    const params = new URLSearchParams({
                        b: String(args.beatmapID),
                        m: String(args.mode),
                    });

                    applyVariant(params, variant);

                    return `/get_scores?${params.toString()}`;
                },

                method: "GET",

                returns: {
                    model: Score,
                    isArray: true,
                },

                mapping: ScoreMapping,
                transformResponse: normalizeLegacyScoresResponse,
            },
        },
    });
}

//#endregion

export const AkatsukiProvider = createAkatsukiProvider({
    id: "akatsuki",
    name: "Akatsuki",
    variant: 0,
});

export const AkatsukiRelaxProvider = createAkatsukiProvider({
    id: "akatsukirx",
    name: "AkatsukiRx",
    variant: 1,
});
