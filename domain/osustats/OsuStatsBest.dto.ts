import { Exclude, Expose, Transform, Type } from "class-transformer";
import { osuStatsDate } from "./OsuStats.transform";
import { Grade } from "@generated/adapter/types";
import { ModUtils, ParsedMod } from "@generated/adapter/mods";
import { SerializableDto } from "@domain/core/Data";

@Exclude()
export class OsuStatsBestScoreMapDto {
    @Expose({ name: "beatmapId" })
    declare beatmapID: number;

    @Expose({ name: "beatmapSetId" })
    declare beatmapsetID: number;

    @Expose()
    declare artist: string;

    @Expose()
    declare title: string;

    @Expose()
    declare version: string;

    @Expose()
    declare creator: string;

    @Expose({ name: "maxCombo" })
    declare maxCombo: number;
}

@Exclude()
export class OsuStatsBestScoreUserDto {
    @Expose({ name: "userId" })
    declare userID: number;

    @Expose({ name: "userName" })
    declare username: string;
}

@Exclude()
export class OsuStatsBestScoreDto extends SerializableDto {
    @Expose()
    @Transform(({ value }) => Number(value))
    declare accuracy: number;

    @Expose({ name: "countMiss" })
    declare misses: number;

    @Expose({ name: "enabledMods" })
    declare mods: string;

    @Expose({ name: "maxCombo" })
    declare maxCombo: number;

    @Expose({ name: "playDate" })
    @Transform(({ value }) => osuStatsDate(value))
    declare endedAt: Date;

    @Expose()
    declare position: number;

    @Expose({ name: "ppValue" })
    @Transform(({ value }) => Number(value))
    declare pp: number;

    @Expose({ name: "rank" })
    declare grade: Grade;

    @Expose()
    declare score: number;

    @Expose({ name: "beatmap" })
    @Type(() => OsuStatsBestScoreMapDto)
    declare map: OsuStatsBestScoreMapDto;

    @Expose({ name: "osu_user" })
    @Type(() => OsuStatsBestScoreUserDto)
    declare user: OsuStatsBestScoreUserDto;

    public parsedMods(): Array<ParsedMod> {
        if (!this.mods || this.mods === "None") {
            return [];
        }

        let mods = ModUtils.parse(
            this.mods
                .split(",")
                .map((mod) => mod.trim())
                .filter(Boolean),
        );

        if (ModUtils.has(mods, "NC")) {
            mods = mods.filter((mod) => mod.acronym !== "DT");
        }

        if (ModUtils.has(mods, "PF")) {
            mods = mods.filter((mod) => mod.acronym !== "SD");
        }

        return mods;
    }
}

@Exclude()
export class OsuStatsBestScoresDto {
    @Expose()
    @Type(() => Date)
    declare startDate: Date;

    @Expose()
    @Type(() => Date)
    declare endDate: Date;

    @Expose()
    @Type(() => OsuStatsBestScoreDto)
    declare scores: Array<OsuStatsBestScoreDto>;
}
