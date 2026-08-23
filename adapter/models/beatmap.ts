import { Field, SchemaModel } from "../builder";
import { GameMode, Genre, Language, Status } from "./common";

export const Covers = SchemaModel.define("Covers", {
    cover: Field.String(),
    coverDouble: Field.String(),
    card: Field.String(),
    cardDouble: Field.String(),
    list: Field.String(),
    listDouble: Field.String(),
    slimcover: Field.String(),
    slimcoverDouble: Field.String(),
});

export const Beatmapset = SchemaModel.define("Beatmapset", {
    id: Field.Int(),
    animeCover: Field.Boolean().Optional(),
    artist: Field.String(),
    artistUnicode: Field.String(),
    covers: Field.Model(Covers),
    creator: Field.String(),
    favoriteCount: Field.Int(),
    genre: Field.Enum(Genre),
    language: Field.Enum(Language),
    nsfw: Field.Boolean(),
    offset: Field.Int(),
    playcount: Field.Int(),
    previewUrl: Field.String(),
    source: Field.String().Optional(),
    spotlight: Field.Boolean(),
    status: Field.Enum(Status),
    title: Field.String(),
    titleUnicode: Field.String(),
    userID: Field.Int(),
    video: Field.Boolean(),
    rankedDate: Field.Date().Optional(),
    submittedDate: Field.Date(),
    tags: Field.String(),
    beatmaps: Field.Model(() => Beatmap)
        .Array()
        .Optional(),
});

export const BeatmapOwner = SchemaModel.define("BeatmapOwner", {
    id: Field.Int(),
    username: Field.String(),
});

export const Beatmap = SchemaModel.define("Beatmap", {
    id: Field.Int(),
    difficulty: Field.Float(),
    beatmapsetID: Field.Int(),
    mode: Field.Enum(GameMode),
    status: Field.Enum(Status),
    totalLength: Field.Int(),
    hitLength: Field.Int(),
    userID: Field.Int(),
    version: Field.String(),
    od: Field.Float(),
    ar: Field.Float(),
    cs: Field.Float(),
    hp: Field.Float(),
    bpm: Field.Float(),
    convert: Field.Boolean(),
    countCircles: Field.Int(),
    countSliders: Field.Int(),
    countSpinners: Field.Int(),
    lastUpdated: Field.Date(),
    url: Field.String(),
    passcount: Field.Int(),
    playcount: Field.Int(),
    checksum: Field.String(),
    ranked: Field.Int(),
    owners: Field.Model(BeatmapOwner).Array(),
    beatmapset: Field.Model(() => Beatmapset).Optional(),
});

export const BeatmapPlaycount = SchemaModel.define("BeatmapPlaycount", {
    beatmapID: Field.Int(),
    count: Field.Int(),
    beatmap: Field.Model(Beatmap).Optional(),
    beatmapset: Field.Model(Beatmapset).Optional(),
});
