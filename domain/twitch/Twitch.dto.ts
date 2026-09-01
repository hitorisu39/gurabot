import { Exclude, Expose, Transform, Type } from "class-transformer";
import { twitchDurationSeconds } from "./Twitch.transform";
import { SerializableDto } from "@domain/core/Data";

@Exclude()
export class OsuToTwitchDto {
    @Expose()
    declare osuID: number;

    @Expose()
    declare twitchID: string;

    @Expose()
    declare createdAt: Date;

    @Expose()
    declare updatedAt: Date;
}

@Exclude()
export class TwitchScoreLinkDto {
    @Expose()
    declare type: "liveplay" | "live";

    @Expose()
    declare url: string;
}

@Exclude()
export class TwitchTokenDto {
    @Expose({ name: "access_token" })
    declare accessToken: string;

    @Expose({ name: "expires_in" })
    declare expiresIn: number;

    @Expose({ name: "refresh_token" })
    declare refreshToken?: string;

    @Expose()
    declare scope?: Array<string>;

    @Expose({ name: "token_type" })
    declare tokenType: string;

    @Expose({ name: "id_token" })
    declare idToken?: string;
}

@Exclude()
export class TwitchIdentityDto {
    @Expose()
    declare sub: string;

    @Expose({ name: "preferred_username" })
    declare preferredUsername?: string;
}

@Exclude()
export class TwitchPaginationDto {
    @Expose()
    declare cursor?: string;
}

@Exclude()
export class TwitchVideoDto extends SerializableDto {
    @Expose()
    declare id: string;

    @Expose({ name: "stream_id" })
    declare streamID: string | null;

    @Expose({ name: "user_id" })
    declare userID: string;

    @Expose({ name: "user_login" })
    declare userLogin: string;

    @Expose({ name: "user_name" })
    declare userName: string;

    @Expose()
    declare title: string;

    @Expose({ name: "created_at" })
    @Type(() => Date)
    declare createdAt: Date;

    @Expose({ name: "published_at" })
    @Type(() => Date)
    declare publishedAt: Date;

    @Expose()
    declare url: string;

    @Expose()
    declare type: "archive" | "highlight" | "upload";

    @Expose()
    @Transform(({ value }) => twitchDurationSeconds(value), { toClassOnly: true })
    declare duration: number;
}

@Exclude()
export class TwitchStreamDto extends SerializableDto {
    @Expose()
    declare id: string;

    @Expose({ name: "user_id" })
    declare userID: string;

    @Expose({ name: "user_login" })
    declare userLogin: string;

    @Expose({ name: "user_name" })
    declare userName: string;

    @Expose({ name: "game_id" })
    declare gameID: string;

    @Expose()
    declare type: string;

    @Expose()
    declare title: string;

    @Expose({ name: "started_at" })
    @Type(() => Date)
    declare startedAt: Date;
}

@Exclude()
export class TwitchVideosResponseDto {
    @Expose()
    @Type(() => TwitchVideoDto)
    declare data: Array<TwitchVideoDto>;

    @Expose()
    @Type(() => TwitchPaginationDto)
    declare pagination: TwitchPaginationDto;
}

@Exclude()
export class TwitchStreamsResponseDto {
    @Expose()
    @Type(() => TwitchStreamDto)
    declare data: Array<TwitchStreamDto>;

    @Expose()
    @Type(() => TwitchPaginationDto)
    declare pagination: TwitchPaginationDto;
}
