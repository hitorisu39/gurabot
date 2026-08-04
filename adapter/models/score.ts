import { Field, SchemaModel } from "../builder";
import { Beatmap, Beatmapset } from "./beatmap";
import { Grade } from "./common";
import { User } from "./user";

export const ScoreStatistics = SchemaModel.define("ScoreStatistics", {
    ignoreMiss: Field.Int(),
    ignoreHit: Field.Int(),
    miss: Field.Int(),
    meh: Field.Int(),
    ok: Field.Int(),
    good: Field.Int(),
    great: Field.Int(),
    perfect: Field.Int(),
    smallTickMiss: Field.Int(),
    smallTickHit: Field.Int(),
    largeTickMiss: Field.Int(),
    largeTickHit: Field.Int(),
    smallBonus: Field.Int(),
    largeBonus: Field.Int(),
    legacyComboIncrease: Field.Int(),
});

export const ScoreWeight = SchemaModel.define("ScoreWeight", {
    percentage: Field.Float(),
    pp: Field.Float(),
});

export const ScoreAttributes = SchemaModel.define("ScoreAttributes", {
    pinned: Field.Boolean(),
});

export const Score = SchemaModel.define("Score", {
    id: Field.Int(),
    index: Field.Int(),
    classicTotalScore: Field.Int(),
    preserve: Field.Boolean().Optional(),
    processed: Field.Boolean().Optional(),
    ranked: Field.Boolean().Optional(),
    maximumStatistics: Field.Model(ScoreStatistics).Optional(),
    mods: Field.Mods(),
    statistics: Field.Model(ScoreStatistics),
    beatmapID: Field.Int(),
    bestID: Field.Int().Optional(),
    grade: Field.Enum(Grade),
    type: Field.String().Optional(),
    userID: Field.Int(),
    accuracy: Field.Float(),
    endedAt: Field.Date(),
    replay: Field.Boolean(),
    perfect: Field.Boolean(),
    legacyPerfect: Field.Boolean().Optional(),
    legacyScoreID: Field.Int().Optional(),
    legacyTotalScore: Field.Int().Optional(),
    maxCombo: Field.Int(),
    passed: Field.Boolean(),
    pp: Field.Float().Optional(),
    totalScore: Field.Int(),
    attributes: Field.Model(ScoreAttributes).Optional(),
    weight: Field.Model(ScoreWeight),
    beatmap: Field.Model(Beatmap).Optional(),
    beatmapset: Field.Model(Beatmapset).Optional(),
    user: Field.Model(User).Optional(),
});
