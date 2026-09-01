import { Field, SchemaModel } from "../builder";
import { Beatmap, Covers } from "./beatmap";
import { GameMode, Genre, Language, MatchEventType, RealtimeRoomEventType, Status } from "./common";
import { Score } from "./score";

//#region Stable

export const Match = SchemaModel.define("Match", {
    id: Field.Int(),
    startTime: Field.Date(),
    endTime: Field.Date().Optional(),
    name: Field.String(),
});

export const MatchEventDetail = SchemaModel.define("MatchEventDetail", {
    type: Field.Enum(MatchEventType),
    text: Field.String().Optional(),
});

export const MatchGame = SchemaModel.define("MatchGame", {
    id: Field.Int(),
    matchID: Field.Int(),
    beatmapID: Field.Int(),
    beatmap: Field.Model(Beatmap).Optional(),
    startTime: Field.Date(),
    endTime: Field.Date().Optional(),
    mode: Field.Enum(GameMode),
    modeInt: Field.Int(),
    mods: Field.String().Array(),
    scoringType: Field.String(),
    teamType: Field.String(),
    scores: Field.Model(Score).Array(),
});

export const MatchEvent = SchemaModel.define("MatchEvent", {
    id: Field.Int(),
    detail: Field.Model(MatchEventDetail),
    timestamp: Field.Date(),
    userID: Field.Int().Optional(),
    game: Field.Model(MatchGame).Optional(),
});

export const MatchUser = SchemaModel.define("MatchUser", {
    id: Field.Int(),
    username: Field.String(),
    countryCode: Field.String(),
    avatarUrl: Field.String(),
    online: Field.Boolean().Optional(),
    lastVisit: Field.Date().Optional(),
});

export const MatchEvents = SchemaModel.define("MatchEvents", {
    match: Field.Model(Match),
    events: Field.Model(MatchEvent).Array(),
    users: Field.Model(MatchUser).Array(),
    firstEventID: Field.Int(),
    latestEventID: Field.Int(),
    currentGameID: Field.Int().Optional(),
});

//#endregion

//#region Lazer

export const RealtimeRoomUser = SchemaModel.define("RealtimeRoomUser", {
    id: Field.Int(),
    username: Field.String(),
    avatarUrl: Field.String(),
    countryCode: Field.String(),
    defaultGroup: Field.String(),
    active: Field.Boolean(),
    bot: Field.Boolean(),
    deleted: Field.Boolean(),
    online: Field.Boolean(),
    supporter: Field.Boolean(),
    lastVisit: Field.Date().Optional(),
    pmFriendsOnly: Field.Boolean(),
    profileColour: Field.String().Optional(),
});

export const RealtimeRoomBeatmap = SchemaModel.define("RealtimeRoomBeatmap", {
    id: Field.Int(),
    beatmapsetID: Field.Int(),
    difficulty: Field.Float(),
    lazerOnly: Field.Boolean(),
    mode: Field.Enum(GameMode),
    status: Field.Enum(Status),
    totalLength: Field.Int(),
    userID: Field.Int(),
    version: Field.String(),
});

export const RealtimeRoomBeatmapset = SchemaModel.define("RealtimeRoomBeatmapset", {
    id: Field.Int(),
    animeCover: Field.Boolean(),
    artist: Field.String(),
    artistUnicode: Field.String(),
    covers: Field.Model(Covers),
    creator: Field.String(),
    favoriteCount: Field.Int(),
    genre: Field.Enum(Genre),
    language: Field.Enum(Language),
    hype: Field.Json().Optional(),
    nsfw: Field.Boolean(),
    offset: Field.Int(),
    playcount: Field.Int(),
    previewUrl: Field.String(),
    source: Field.String().Optional(),
    spotlight: Field.Boolean(),
    status: Field.Enum(Status),
    title: Field.String(),
    titleUnicode: Field.String(),
    trackID: Field.Int().Optional(),
    userID: Field.Int(),
    video: Field.Boolean(),
});

export const RealtimeRoom = SchemaModel.define("RealtimeRoom", {
    id: Field.Int(),
    name: Field.String(),
    description: Field.String().Optional(),
    category: Field.String(),
    status: Field.String(),
    type: Field.String(),
    userID: Field.Int(),
    startsAt: Field.Date(),
    endsAt: Field.Date().Optional(),
    maxAttempts: Field.Int().Optional(),
    maxParticipants: Field.Int().Optional(),
    participantCount: Field.Int(),
    channelID: Field.Int().Optional(),
    active: Field.Boolean(),
    hasPassword: Field.Boolean(),
    queueMode: Field.String().Optional(),
    autoSkip: Field.Boolean(),
    pinned: Field.Boolean(),
});

export const RealtimeRoomPlaylistItem = SchemaModel.define("RealtimeRoomPlaylistItem", {
    id: Field.Int(),
    roomID: Field.Int(),
    beatmapID: Field.Int(),
    createdAt: Field.Date(),
    rulesetID: Field.Int(),
    allowedMods: Field.Mods(),
    requiredMods: Field.Mods(),
    freestyle: Field.Boolean(),
    expired: Field.Boolean(),
    ownerID: Field.Int().Optional(),
    playlistOrder: Field.Int().Optional(),
    playedAt: Field.Date().Optional(),

    // Shape depends on the event/item type.
    details: Field.Json(),
    scores: Field.Model(Score).Array(),
});

export const RealtimeRoomEvent = SchemaModel.define("RealtimeRoomEvent", {
    id: Field.Int(),
    createdAt: Field.Date(),
    eventType: Field.Enum(RealtimeRoomEventType),
    playlistItemID: Field.Int().Optional(),
    userID: Field.Int().Optional(),
});

export const RealtimeRoomEvents = SchemaModel.define("RealtimeRoomEvents", {
    beatmaps: Field.Model(RealtimeRoomBeatmap).Array(),
    beatmapsets: Field.Model(RealtimeRoomBeatmapset).Array(),
    currentPlaylistItemID: Field.Int().Optional(),
    events: Field.Model(RealtimeRoomEvent).Array(),
    firstEventID: Field.Int(),
    lastEventID: Field.Int(),
    playlistItems: Field.Model(RealtimeRoomPlaylistItem).Array(),
    room: Field.Model(RealtimeRoom),
    users: Field.Model(RealtimeRoomUser).Array(),
});

//#endregion
