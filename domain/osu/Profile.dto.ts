import { AdapterProvider, GameMode, User } from "@generated/adapter/types";
import { Exclude, Expose } from "class-transformer";

export const LinkableAdapterProvider = {
    Bancho: AdapterProvider.Bancho,
    Akatsuki: AdapterProvider.Akatsuki,
} as const;

export type LinkableAdapterProvider = (typeof LinkableAdapterProvider)[keyof typeof LinkableAdapterProvider];

@Exclude()
export class PopulatedUser extends User {
    @Expose()
    declare mode: GameMode;

    @Expose()
    declare provider: AdapterProvider;
}
