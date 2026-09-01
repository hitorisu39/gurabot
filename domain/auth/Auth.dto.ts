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

@Exclude()
export class AuthTwitchStateDto {
    @Expose()
    declare discord: string;

    @Expose()
    declare osuID: number;
}
