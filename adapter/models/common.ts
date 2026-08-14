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
