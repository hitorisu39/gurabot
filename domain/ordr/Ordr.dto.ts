import { Exclude, Expose, Type } from "class-transformer";

@Exclude()
export class OrdrPresetDto {
    @Expose()
    declare presetName: string;

    @Expose()
    declare lastSavedOn: string;
}

@Exclude()
export class OrdrRenderLookupEntryDto {
    @Expose()
    @Type(() => Number)
    declare mapID: number;
}

@Exclude()
export class OrdrRenderLookupDto {
    @Expose()
    @Type(() => OrdrRenderLookupEntryDto)
    declare renders: Array<OrdrRenderLookupEntryDto>;
}

@Exclude()
export class OrdrOfficialSkinLookupDto {
    @Expose()
    @Type(() => OrdrOfficialSkinDto)
    declare match: OrdrOfficialSkinDto | null;

    @Expose()
    @Type(() => OrdrOfficialSkinDto)
    declare suggestions: Array<OrdrOfficialSkinDto>;
}

@Exclude()
export class OrdrCustomSkinDto {
    @Expose()
    declare found: boolean;

    @Expose()
    declare removed: boolean;

    @Expose()
    declare message: string;

    @Expose()
    declare skinName: string;

    @Expose()
    declare skinAuthor: string;

    @Expose()
    declare downloadLink: string;
}

@Exclude()
export class OrdrRenderCreateDto {
    @Expose()
    declare renderID: number;

    @Expose()
    declare message?: string;

    @Expose()
    declare errorCode?: number;
}

@Exclude()
export class OrdrReplayFileDto {
    @Expose()
    declare name: string;

    @Expose()
    declare url: string;

    @Expose()
    declare size: number;

    @Expose()
    declare contentType: string | null;
}

@Exclude()
export class OrdrRenderAddedDto {
    @Expose()
    declare renderID: number;
}

@Exclude()
export class OrdrRenderProgressDto {
    @Expose()
    declare renderID: number;

    @Expose()
    declare username: string;

    @Expose()
    declare progress: string;

    @Expose()
    declare renderer: string;

    @Expose()
    declare description: string;
}

@Exclude()
export class OrdrRenderDoneDto {
    @Expose()
    declare renderID: number;

    @Expose()
    declare videoUrl: string;
}

@Exclude()
export class OrdrOfficialSkinDto {
    @Expose()
    declare skin: string;

    @Expose()
    declare presentationName: string;

    @Expose()
    declare url: string;

    @Expose()
    declare highResPreview: string;

    @Expose()
    declare lowResPreview: string;

    @Expose()
    declare gridPreview: string;

    @Expose()
    declare id: number;

    @Expose()
    declare hasCursorMiddle: boolean;

    @Expose()
    declare author?: string;

    @Expose()
    declare modified?: boolean;

    @Expose()
    declare version?: string;

    @Expose()
    declare timesUsed?: number;
}

@Exclude()
export class OrdrOfficialSkinsDto {
    @Expose()
    declare message: string;

    @Expose()
    @Type(() => OrdrOfficialSkinDto)
    declare skins: Array<OrdrOfficialSkinDto>;

    @Expose()
    declare maxSkins: number;
}

@Exclude()
export class OrdrRenderFailedDto {
    @Expose()
    declare renderID: number;

    @Expose()
    declare errorCode: number;

    @Expose()
    declare errorMessage: string;
}

@Exclude()
export class OrdrCachedScoreDto {
    @Expose()
    declare scoreID: string;

    @Expose()
    declare renderID: number;

    @Expose()
    declare videoURL: string;

    @Expose()
    @Type(() => Date)
    declare createdAt: Date;
}

export type TOrdrRenderEvent =
    | { type: "added"; data: OrdrRenderAddedDto }
    | { type: "progress"; data: OrdrRenderProgressDto }
    | { type: "done"; data: OrdrRenderDoneDto }
    | { type: "failed"; data: OrdrRenderFailedDto };

export type TOrdrRenderTerminalEvent = Extract<TOrdrRenderEvent, { type: "done" | "failed" }>;
