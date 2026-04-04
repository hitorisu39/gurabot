import { EAuthConnectionType } from "../enums/Auth.enum";

export const authConnectionOkImage = "checkmark";
export const authConnectionFailImage = "fail";

export const authConnectionImage: Record<EAuthConnectionType, string> = {
    [EAuthConnectionType.Osu]: "osu_auth",
    [EAuthConnectionType.Twitch]: "twitch_auth",
};
