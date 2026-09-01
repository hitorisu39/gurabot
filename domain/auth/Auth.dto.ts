import { AdapterProvider } from "@generated/adapter/types";
import { Exclude, Expose } from "class-transformer";

// osu!
export interface IAuthResponse {
    token_type: string;
    expires_in: number;
    access_token: string;
}

@Exclude()
export class AuthOsuStateDto {
    @Expose()
    declare discord: string;

    @Expose()
    declare provider: AdapterProvider;
}

// Twitch
export interface ITwitchAuthResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope: Array<string>;
    id_token?: string;
}

export interface ITwitchUserInfo {
    sub: string;
    preferred_username?: string;
}

@Exclude()
export class AuthTwitchStateDto {
    @Expose()
    declare discord: string;

    @Expose()
    declare osuID: number;
}
