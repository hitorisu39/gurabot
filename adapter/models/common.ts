import { SchemaEnum } from "../builder";

export const GameMode = SchemaEnum.define("GameMode", {
    Standard: "Standard",
    Taiko: "Taiko",
    Catch: "Catch",
    Mania: "Mania",
});

export const Grade = SchemaEnum.define("Grade", {
    SSH: "SSH",
    SS: "SS",
    SH: "SH",
    S: "S",
    A: "A",
    B: "B",
    C: "C",
    D: "D",
    F: "F",
});

export const Status = SchemaEnum.define("Status", {
    Ranked: "Ranked",
    Graveyard: "Graveyard",
    Loved: "Loved",
    Pending: "Pending",
    Approved: "Approved",
    Qualified: "Qualified",
    WIP: "WIP",
});

export const Genre = SchemaEnum.define("Genre", {
    Any: "Any",
    Unspecified: "Unspecified",
    VideoGame: "VideoGame",
    Anime: "Anime",
    Rock: "Rock",
    Pop: "Pop",
    Other: "Other",
    Novelty: "Novelty",
    HipHop: "HipHop",
    Electronic: "Electronic",
    Metal: "Metal",
    Classical: "Classical",
    Folk: "Folk",
    Jazz: "Jazz",
});

export const Language = SchemaEnum.define("Language", {
    Any: "Any",
    Other: "Other",
    English: "English",
    Japanese: "Japanese",
    Chinese: "Chinese",
    Instrumental: "Instrumental",
    Korean: "Korean",
    French: "French",
    German: "German",
    Swedish: "Swedish",
    Spanish: "Spanish",
    Italian: "Italian",
    Russian: "Russian",
    Polish: "Polish",
    Unspecified: "Unspecified",
});

export const RankingType = SchemaEnum.define("RankingType", {
    Performance: "Performance",
    Score: "Score",
    Country: "Country",
    Charts: "Charts",
});

export const BeatmapSearchStatus = SchemaEnum.define("BeatmapSearchStatus", {
    Any: "Any",
    Leaderboard: "Leaderboard",
    Ranked: "Ranked",
    Qualified: "Qualified",
    Loved: "Loved",
    Favourites: "Favourites",
    Pending: "Pending",
    WIP: "WIP",
    Graveyard: "Graveyard",
    Mine: "Mine",
});

export const BeatmapSearchExtra = SchemaEnum.define("BeatmapSearchExtra", {
    Video: "Video",
    Storyboard: "Storyboard",
});

export const BeatmapSearchGeneral = SchemaEnum.define("BeatmapSearchGeneral", {
    Recommended: "Recommended",
    Converts: "Converts",
    Follows: "Follows",
    Spotlights: "Spotlights",
    FeaturedArtists: "FeaturedArtists",
});

export const BeatmapSearchPlayed = SchemaEnum.define("BeatmapSearchPlayed", {
    Any: "Any",
    Played: "Played",
    Unplayed: "Unplayed",
});

export const BeatmapSearchRank = SchemaEnum.define("BeatmapSearchRank", {
    SSH: "SSH",
    SS: "SS",
    SH: "SH",
    S: "S",
    A: "A",
    B: "B",
    C: "C",
    D: "D",
});

export const BeatmapSearchSortField = SchemaEnum.define("BeatmapSearchSortField", {
    Artist: "Artist",
    Creator: "Creator",
    Difficulty: "Difficulty",
    Favourites: "Favourites",
    Nominations: "Nominations",
    Plays: "Plays",
    Ranked: "Ranked",
    Rating: "Rating",
    Relevance: "Relevance",
    Title: "Title",
    Updated: "Updated",
});

export const BeatmapSearchSortOrder = SchemaEnum.define("BeatmapSearchSortOrder", {
    Ascending: "Asc",
    Descending: "Desc",
});
