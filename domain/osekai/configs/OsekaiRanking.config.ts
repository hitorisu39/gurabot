import { EOsekaiRanking, EOsekaiRankingEntryType, EOsekaiRankingValueFormat } from "../enums/OsekaiRanking.enum";
import { OsekaiRankingMetaDto } from "../OsekaiRanking.dto";

export const osekaiRankingBase = "https://inex.osekai.net/rankings";

/**
 * Osekai API pagination size.
 */
export const osekaiRankingApiPageSize = 50;

/**
 * The amount per page displayed in Discord itself.
 */
export const osekaiRankingPageSize = 20;

export const osekaiRankingMeta: Record<EOsekaiRanking, OsekaiRankingMetaDto> = {
    [EOsekaiRanking.MedalCount]: {
        type: "medals_users",
        title: "Medal Count",
        url: `${osekaiRankingBase}/medals_users`,
        valueField: "Count_Medals",
        valueFormat: EOsekaiRankingValueFormat.Integer,
        entryType: EOsekaiRankingEntryType.User,
    },

    [EOsekaiRanking.MedalRarity]: {
        type: "medals_rarity",
        title: "Medal Rarity",
        url: `${osekaiRankingBase}/medals_rarity`,
        valueField: "Frequency",
        valueFormat: EOsekaiRankingValueFormat.MedalRarity,
        entryType: EOsekaiRankingEntryType.Medal,
    },

    [EOsekaiRanking.PPStandardDeviation]: {
        type: "pp",
        optionType: "stdev",
        title: "PP Standard Deviation",
        url: `${osekaiRankingBase}/pp?type=stdev`,
        valueField: "PP_Stdev",
        valueFormat: EOsekaiRankingValueFormat.PP,
        entryType: EOsekaiRankingEntryType.User,
    },

    [EOsekaiRanking.PPTotal]: {
        type: "pp",
        optionType: "total",
        title: "Total PP",
        url: `${osekaiRankingBase}/pp?type=total`,
        valueField: "PP_Total",
        valueFormat: EOsekaiRankingValueFormat.PP,
        entryType: EOsekaiRankingEntryType.User,
    },

    [EOsekaiRanking.LevelStandardDeviation]: {
        type: "level",
        optionType: "stdev",
        title: "Level Standard Deviation",
        url: `${osekaiRankingBase}/level?type=stdev`,
        valueField: "Level_Stdev",
        valueFormat: EOsekaiRankingValueFormat.Decimal,
        entryType: EOsekaiRankingEntryType.User,
    },

    [EOsekaiRanking.LevelTotal]: {
        type: "level",
        optionType: "total",
        title: "Total Level",
        url: `${osekaiRankingBase}/level?type=total`,
        valueField: "Level_Total",
        valueFormat: EOsekaiRankingValueFormat.Decimal,
        entryType: EOsekaiRankingEntryType.User,
    },

    [EOsekaiRanking.AccuracyStandardDeviation]: {
        type: "accuracy",
        optionType: "stdev",
        title: "Accuracy Standard Deviation",
        url: `${osekaiRankingBase}/accuracy?type=stdev`,
        valueField: "Accuracy_Stdev",
        valueFormat: EOsekaiRankingValueFormat.Decimal,
        entryType: EOsekaiRankingEntryType.User,
    },

    [EOsekaiRanking.AccuracyTotal]: {
        type: "accuracy",
        optionType: "total",
        title: "Total Accuracy",
        url: `${osekaiRankingBase}/accuracy?type=total`,
        valueField: "Accuracy_Total",
        valueFormat: EOsekaiRankingValueFormat.Decimal,
        entryType: EOsekaiRankingEntryType.User,
    },

    [EOsekaiRanking.Replays]: {
        type: "replays",
        title: "Replays Watched",
        url: `${osekaiRankingBase}/replays`,
        valueField: "Count_Replays_Watched",
        valueFormat: EOsekaiRankingValueFormat.Integer,
        entryType: EOsekaiRankingEntryType.User,
    },

    [EOsekaiRanking.RankedMapsets]: {
        type: "mapsets",
        optionType: "ranked",
        title: "Ranked Mapsets",
        url: `${osekaiRankingBase}/mapsets?type=ranked`,
        valueField: "Count_Maps_Ranked",
        valueFormat: EOsekaiRankingValueFormat.Integer,
        entryType: EOsekaiRankingEntryType.User,
    },

    [EOsekaiRanking.LovedMapsets]: {
        type: "mapsets",
        optionType: "loved",
        title: "Loved Mapsets",
        url: `${osekaiRankingBase}/mapsets?type=loved`,
        valueField: "Count_Maps_Loved",
        valueFormat: EOsekaiRankingValueFormat.Integer,
        entryType: EOsekaiRankingEntryType.User,
    },

    [EOsekaiRanking.Subscribers]: {
        type: "subscribers",
        title: "Subscribers",
        url: `${osekaiRankingBase}/subscribers`,
        valueField: "Count_Subscribers",
        valueFormat: EOsekaiRankingValueFormat.Integer,
        entryType: EOsekaiRankingEntryType.User,
    },

    [EOsekaiRanking.Badges]: {
        type: "badges",
        title: "Badges",
        url: `${osekaiRankingBase}/badges`,
        valueField: "Count_Badges",
        valueFormat: EOsekaiRankingValueFormat.Integer,
        entryType: EOsekaiRankingEntryType.User,
    },

    [EOsekaiRanking.PlaytimeStandardDeviation]: {
        type: "playtime",
        optionType: "stdev",
        title: "Playtime Standard Deviation",
        url: `${osekaiRankingBase}/playtime?type=stdev`,
        valueField: "Play_Time_Stdev",
        valueFormat: EOsekaiRankingValueFormat.PlaytimeStandardDeviation,
        entryType: EOsekaiRankingEntryType.User,
    },

    [EOsekaiRanking.PlaytimeTotal]: {
        type: "playtime",
        optionType: "total",
        title: "Total Playtime",
        url: `${osekaiRankingBase}/playtime?type=total`,
        valueField: "Play_Time_Total",
        valueFormat: EOsekaiRankingValueFormat.PlaytimeTotal,
        entryType: EOsekaiRankingEntryType.User,
    },
};
