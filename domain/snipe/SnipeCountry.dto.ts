import { Exclude, Expose, Transform, Type } from "class-transformer";
import { transformCountryCode } from "./Snipe.transform";
import { SerializableDto } from "@domain/core/Data";

@Exclude()
export class SnipeCountryStatisticsDto extends SerializableDto {
    @Expose({ name: "total_maps" })
    declare totalMaps?: number;

    @Expose({ name: "unplayed_count" })
    declare unplayedMaps: number;

    @Expose({ name: "most_gained_count" })
    declare mostGainsCount?: number;

    @Expose({ name: "most_gained_player_id" })
    declare mostGainsUserID?: number;

    @Expose({ name: "most_gained_player_name" })
    declare mostGainsUsername?: string;

    @Expose({ name: "most_lost_count" })
    declare mostLossesCount?: number;

    @Expose({ name: "most_lost_player_id" })
    declare mostLossesUserID?: number;

    @Expose({ name: "most_lost_player_name" })
    declare mostLossesUsername?: string;
}

@Exclude()
export class SnipeCountryDto extends SerializableDto {
    @Expose({ name: "country_code" })
    @Transform(transformCountryCode, { toClassOnly: true })
    declare countryCode: string;
}

@Exclude()
export class SnipeCountriesDto extends SerializableDto {
    @Expose()
    @Type(() => SnipeCountryDto)
    declare countries: Array<SnipeCountryDto>;
}
