export const scoreUrlRegex = /^https:\/\/osu\.ppy\.sh\/scores\/([0-9]+)$/i;
export const scoreUrlSearchRegex = /https:\/\/osu\.ppy\.sh\/scores\/([0-9]+)(?=$|[\s)\]}>.,!?])/i;
export const scoreThumbnailRegex =
    /^https:\/\/assets\.ppy\.sh\/beatmaps\/[0-9]+\/covers\/[^?]+\?.*\bscore_id=([0-9]+)(?:&|$)/i;

/**
 * 10 scores per page in compact version of the list.
 */
export const scoreCompactPageSize = 10;

/**
 * 5 scores per page in detailed version of the list.
 */
export const scoreDetailedPageSize = 5;

/**
 * Default delimiter for score statistics.
 */
export const scoreStatsDelimiter = "  •  ";

/**
 * Compact delimiter for dense hit-count displays.
 */
export const scoreStatsCompactDelimiter = " • ";

/**
 * How many best scores we want to fetch for use in commands.
 */
export const scoreBestQueryLimit = 100;

/**
 * How many recent scores we want to fetch for use in commands.
 */
export const scoreRecentQueryLimit = 100;

/**
 * How many pinned scores we want to fetch for use in commands.
 */
export const scorePinnedQueryLimit = 100;
