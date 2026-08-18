import { Exclude, Expose, instanceToPlain, Transform, TransformationType, Type } from "class-transformer";
import { osekaiMedalBase } from "./configs/OsekaiMedal.config";

function transformBoolean(value: unknown): boolean {
    return value === true || value === 1 || value === "1";
}

@Exclude()
export class OsekaiMedalDto {
    @Expose({ name: "Medal_ID" })
    @Type(() => Number)
    declare id: number;

    @Expose({ name: "Name" })
    declare name: string;

    @Expose({ name: "Link" })
    declare link: string;

    @Expose({ name: "Description" })
    declare description: string;

    @Expose({ name: "Gamemode" })
    @Transform(({ value }) => value || null, { toClassOnly: true })
    declare gamemode: string | null;

    @Expose({ name: "Grouping" })
    declare grouping: string;

    @Expose({ name: "Instructions" })
    declare instructions: string | null;

    @Expose({ name: "Ordering" })
    @Type(() => Number)
    declare ordering: number;

    @Expose({ name: "Frequency" })
    @Transform(({ value, type }) => {
        if (value === null || value === undefined) return null;

        const frequency = Number(value);
        if (!Number.isFinite(frequency)) return null;

        switch (type) {
            case TransformationType.PLAIN_TO_CLASS:
                return frequency * 100;
            case TransformationType.CLASS_TO_PLAIN:
                return frequency / 100;
            default:
                return frequency;
        }
    })
    declare frequency: number | null;

    @Expose({ name: "Count_Achieved_By" })
    @Type(() => Number)
    declare achievedBy: number;

    @Expose({ name: "Solution" })
    declare solution: string | null;

    @Expose({ name: "Is_Solution_Found" })
    @Transform(({ value }) => transformBoolean(value), { toClassOnly: true })
    declare solutionFound: boolean;

    @Expose({ name: "Video_URL" })
    declare videoURL: string | null;

    @Expose({ name: "Supports_Lazer" })
    @Transform(({ value }) => transformBoolean(value), { toClassOnly: true })
    declare supportsLazer: boolean;

    @Expose({ name: "Supports_Stable" })
    @Transform(({ value }) => transformBoolean(value), { toClassOnly: true })
    declare supportsStable: boolean;

    @Expose({ name: "Is_Restricted" })
    @Transform(({ value }) => transformBoolean(value), { toClassOnly: true })
    declare restricted: boolean;

    @Expose({ name: "Date_Released" })
    @Type(() => Date)
    declare releasedAt: Date | null;

    @Expose({ name: "First_Achieved_Date" })
    @Type(() => Date)
    declare firstAchievedAt: Date | null;

    @Expose({ name: "First_Achieved_User_ID" })
    @Transform(
        ({ value }) => {
            if (value === null || value === undefined || value === "") {
                return null;
            }

            return Number(value);
        },
        { toClassOnly: true },
    )
    declare firstAchievedUserID: number | null;

    @Expose({ name: "First_Achieved_Username" })
    declare firstAchievedUsername: string | null;

    @Expose({ name: "Mods" })
    declare mods: string | null;

    @Expose({ name: "Packs" })
    declare packs: string | null;

    public url(): string {
        return `${osekaiMedalBase}${encodeURIComponent(this.name)}`;
    }

    toJSON() {
        return instanceToPlain(this, {
            excludeExtraneousValues: true,
        });
    }
}

@Exclude()
export class OsekaiMedalBeatmapDto {
    @Expose({ name: "Beatmap_ID" })
    @Type(() => Number)
    declare beatmapID: number;

    @Expose({ name: "Song_Title" })
    declare title: string;

    @Expose({ name: "Song_Artist" })
    declare artist: string;

    @Expose({ name: "Difficulty_Name" })
    declare difficulty: string;

    @Expose({ name: "Mapper_Name" })
    declare mapper: string;

    @Expose({ name: "VoteCount" })
    @Type(() => Number)
    declare votes: number;

    toJSON() {
        return instanceToPlain(this, {
            excludeExtraneousValues: true,
        });
    }
}

@Exclude()
export class OsekaiMedalCommentDto {
    @Expose({ name: "ID" })
    @Type(() => Number)
    declare id: number;

    @Expose({ name: "User_ID" })
    @Type(() => Number)
    declare userID: number;

    @Expose({ name: "Username" })
    declare username: string | null;

    @Expose({ name: "Text" })
    declare text: string;

    @Expose({ name: "Date" })
    @Type(() => Date)
    declare date: Date;

    @Expose({ name: "VoteCount" })
    @Type(() => Number)
    declare votes: number;

    @Expose({ name: "Replies" })
    @Type(() => Number)
    declare replies: number;

    @Expose({ name: "Is_Pinned" })
    @Transform(({ value }) => value === true || value === 1 || value === "1", { toClassOnly: true })
    declare pinned: boolean;

    toJSON() {
        return instanceToPlain(this, {
            excludeExtraneousValues: true,
        });
    }
}
