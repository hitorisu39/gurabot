export const osuBaseDomain = "osu.ppy.sh";
export const osuBaseUrl = "https://osu.ppy.sh";

export const osuBaseAssetsDomain = "assets.ppy.sh";
export const osuBaseAssetsUrl = "https://assets.ppy.sh";

/**
 * Downloadable implies we can use it to download mapsets. Fallbacks in the defined order.
 * Display is for the map embed (to match height with the left stats block).
 */
export const osuMapsetDownloads = [
    { name: "osu!direct", base: "https://gurabot.com/direct", downloadable: false, display: true },
    { name: "nerinyan.moe", base: "https://nerinyan.moe/d", downloadable: false, display: true },
    { name: "mino", base: "https://catboy.best/d", downloadable: true, display: true },
    { name: "beatconnect", base: "https://beatconnect.io/b", downloadable: true, display: false },
];
