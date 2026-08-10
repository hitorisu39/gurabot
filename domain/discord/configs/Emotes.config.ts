import { GameMode, Grade } from "@generated/adapter/types";

export const discordEmoteGrades: Record<Grade, string> = {
    [Grade.SSH]: "<:rankingXH:1302193828547268679>",
    [Grade.SS]: "<:rankingX:1302193840135999532>",
    [Grade.SH]: "<:rankingSH:1302193838340706334>",
    [Grade.S]: "<:rankingS:1302193836591943770>",
    [Grade.A]: "<:rankingA:1302199475481350164>",
    [Grade.B]: "<:rankingB:1302197360482586656>",
    [Grade.C]: "<:rankingC:1302198754748665917>",
    [Grade.D]: "<:rankingD:1302208140087001099>",
    [Grade.F]: "<:rankingF:888890009229348885>",
};

export const discordEmoteModes: Record<GameMode, string> = {
    [GameMode.Standard]: "<:osu_std:1485987065878286388>",
    [GameMode.Taiko]: "<:osu_taiko:1485987084006068245>",
    [GameMode.Catch]: "<:osu_catch:1485987104067555398>",
    [GameMode.Mania]: "<:osu_mania:1485987127492870184>",
};

export const discordIconModes: Record<GameMode, string> = {
    [GameMode.Standard]: "https://cdn.discordapp.com/emojis/1485987065878286388.webp?size=96",
    [GameMode.Taiko]: "https://cdn.discordapp.com/emojis/1485987084006068245.webp?size=96",
    [GameMode.Catch]: "https://cdn.discordapp.com/emojis/1485987104067555398.webp?size=96",
    [GameMode.Mania]: "https://cdn.discordapp.com/emojis/1485987127492870184.webp?size=96",
};

export const discordEmoteDifficulty: Record<string, string> = {
    std_0: "<:std_0:888889368809467944>",
    std_1: "<:std_1:888889370520723546>",
    std_2: "<:std_2:888889368683638835>",
    std_3: "<:std_3:888889368595554324>",
    std_4: "<:std_4:888889368381628497>",
    std_5: "<:std_5:888889368574574713>",
    std_6: "<:std_6:888889368473927681>",
    std_7: "<:std_7:888889368729755698>",
    std_8: "<:std_8:888889368633278465>",
    std_9: "<:std_9:891024121448787968>",

    taiko_0: "<:taiko_0:888889368331300865>",
    taiko_1: "<:taiko_1:888889368381640765>",
    taiko_2: "<:taiko_2:888889368700391435>",
    taiko_3: "<:taiko_3:888889368696197191>",
    taiko_4: "<:taiko_4:888889369161777182>",
    taiko_5: "<:taiko_5:888889369069510676>",
    taiko_6: "<:taiko_6:888889369124032572>",
    taiko_7: "<:taiko_7:888889368989810748>",
    taiko_8: "<:taiko_8:888889369115656222>",
    taiko_9: "<:taiko_9:891024121339711550>",

    ctb_0: "<:ctb_0:888889361851113533>",
    ctb_1: "<:ctb_1:888889362048225321>",
    ctb_2: "<:ctb_2:888889362371182643>",
    ctb_3: "<:ctb_3:888889362253742113>",
    ctb_4: "<:ctb_4:888889363679834172>",
    ctb_5: "<:ctb_5:888889363843383376>",
    ctb_6: "<:ctb_6:888889364287979531>",
    ctb_7: "<:ctb_7:888889364271226882>",
    ctb_8: "<:ctb_8:888889364883582976>",
    ctb_9: "<:ctb_9:891024090071179294>",

    mania_0: "<:mania_0:888889365206560768>",
    mania_1: "<:mania_1:888889365034569768>",
    mania_2: "<:mania_2:888889364900368435>",
    mania_3: "<:mania_3:888889365256876042>",
    mania_4: "<:mania_4:888889365688877126>",
    mania_5: "<:mania_5:888889367593103420>",
    mania_6: "<:mania_6:888889367601496075>",
    mania_7: "<:mania_7:888889367437934634>",
    mania_8: "<:mania_8:888889367605690439>",
    mania_9: "<:mania_9:891024121511702538>",
};

export const modeEmoteKeys: Record<GameMode, string> = {
    [GameMode.Standard]: "std",
    [GameMode.Taiko]: "taiko",
    [GameMode.Catch]: "ctb",
    [GameMode.Mania]: "mania",
};

export const discordEmoteBot = "<:gurabot:1536113796139982980>";
export const discordEmoteBotUrl = "https://cdn.discordapp.com/emojis/1536113796139982980.webp?size=96";

export const discordEmoteMiss = "<:miss:1066017215398297670>";
export const discordEmoteTwitch = "<:twitch:1107316073642074202>";
export const discordEmoteProcessing = "<:still_processing:1205488634040422441>";

export const discordEmoteCircles = "<:circles:1301565863802966117>";
export const discordEmoteSliders = "<:sliders:1301565891342893188>";
export const discordEmoteSpinners = "<:spinners:1301565914789052538>";

export const discordEmoteOnline = "<:online:888890708436611072>";
export const discordEmoteOffline = "<:offline:888890708310753351>";
export const discordEmoteOnlineUrl = "https://cdn.discordapp.com/emojis/888890708436611072.webp?size=96";
export const discordEmoteOfflineUrl = "https://cdn.discordapp.com/emojis/888890708310753351.webp?size=96";
