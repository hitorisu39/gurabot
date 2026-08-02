import { OrdrPresetDto, OrdrReplayFileDto } from "@domain/ordr/Ordr.dto";
import { OrdrConfigDto } from "@domain/ordr/OrdrConfig.dto";
import { Exclude, Expose, Type } from "class-transformer";

export enum EOrdrRenderStage {
    Confirmation = "Confirmation",
    Submitting = "Submitting",
    Queued = "Queued",
    Rendering = "Rendering",
    Done = "Done",
    Failed = "Failed",
}

@Exclude()
export class OrdrSkinChoiceDto {
    @Expose()
    declare skin: string;

    @Expose()
    declare customSkin: boolean;

    @Expose()
    declare label: string;

    @Expose()
    declare description: string;
}

@Exclude()
export class OrdrRenderViewDto {
    @Expose()
    declare authorID: string;

    @Expose()
    @Type(() => OrdrReplayFileDto)
    declare replay: OrdrReplayFileDto;

    @Expose()
    @Type(() => OrdrConfigDto)
    declare config: OrdrConfigDto;

    @Expose()
    @Type(() => OrdrPresetDto)
    declare preset: OrdrPresetDto | null;

    @Expose()
    @Type(() => OrdrSkinChoiceDto)
    declare skins: Array<OrdrSkinChoiceDto>;

    @Expose()
    declare stage: EOrdrRenderStage;

    @Expose()
    declare notice?: string;

    @Expose()
    declare renderID?: number;

    @Expose()
    declare progress?: string;

    @Expose()
    declare renderer?: string;

    @Expose()
    declare description?: string;

    @Expose()
    declare videoURL?: string;

    @Expose()
    declare errorCode?: number;

    @Expose()
    declare errorMessage?: string;
}
