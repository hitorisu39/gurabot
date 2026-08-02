import { OrdrPresetDto } from "@domain/ordr/Ordr.dto";
import { OrdrConfigDto } from "@domain/ordr/OrdrConfig.dto";
import { Exclude, Expose, Type } from "class-transformer";

export enum EOrdrConfigView {
    Overview = "Overview",
    Output = "Output",
    Audio = "Audio",
    HUD = "HUD",
    Gameplay = "Gameplay",
    Background = "Background",
}

@Exclude()
export class OrdrConfigViewDto {
    @Expose()
    declare authorID: string;

    @Expose()
    declare view: EOrdrConfigView;

    @Expose()
    @Type(() => OrdrConfigDto)
    declare original: OrdrConfigDto;

    @Expose()
    @Type(() => OrdrConfigDto)
    declare draft: OrdrConfigDto;

    @Expose()
    @Type(() => OrdrPresetDto)
    declare preset: OrdrPresetDto | null;
}
