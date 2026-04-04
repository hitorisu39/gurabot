import { AdapterProvider, GameMode, User } from "@generated/adapter/types";
import { Exclude, Expose } from "class-transformer";

@Exclude()
export class PopulatedUser extends User {
    @Expose()
    declare mode: GameMode;

    @Expose()
    declare provider: AdapterProvider;
}
