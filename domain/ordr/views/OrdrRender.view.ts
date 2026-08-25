import { OrdrPresetDto, OrdrReplayFileDto } from "@domain/ordr/Ordr.dto";
import { OrdrConfigDto } from "@domain/ordr/OrdrConfig.dto";
import { GameMode } from "@generated/adapter/types";
import { Exclude, Expose, Type } from "class-transformer";

export enum EOrdrRenderStage {
    Cached = "Cached",
    Confirmation = "Confirmation",
    AlreadyRendering = "AlreadyRendering",
    Submitting = "Submitting",
    Queued = "Queued",
    Rendering = "Rendering",
    Done = "Done",
    Failed = "Failed",
}

export enum EOrdrRenderInput {
    Replay = "Replay",
    Score = "Score",
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
export class OrdrRenderScoreDto {
    @Expose()
    declare id: string;

    @Expose()
    declare userID: number;

    @Expose()
    declare username: string;

    @Expose()
    declare beatmapID: number;

    @Expose()
    declare beatmapsetID: number;

    @Expose()
    declare artist: string;

    @Expose()
    declare title: string;

    @Expose()
    declare version: string;

    @Expose()
    declare mode: GameMode;

    @Expose()
    declare mods: string;

    @Expose()
    declare accuracy: number;

    @Expose()
    declare pp?: number;

    @Expose()
    declare maxCombo: number;

    @Expose()
    @Type(() => Date)
    declare endedAt: Date;
}

@Exclude()
export class OrdrRenderViewDto {
    @Expose()
    declare authorID: string;

    @Expose()
    declare input: EOrdrRenderInput;

    @Expose()
    @Type(() => OrdrReplayFileDto)
    declare replay?: OrdrReplayFileDto;

    @Expose()
    declare scoreID?: string;

    @Expose()
    @Type(() => OrdrRenderScoreDto)
    declare score?: OrdrRenderScoreDto;

    @Expose()
    declare cachedVideoURL?: string;

    @Expose()
    declare cachedRenderID?: number;

    /**
     * Set when the user presses Re-render.
     */
    @Expose()
    declare forceRerender?: boolean;

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
