import { Import, Trace } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { CalculatorService } from "@/modules/osu/calculator/Calculator.service";
import { OsuService } from "@/modules/osu/Osu.service";
import { FarmService } from "@/modules/farm/Farm.service";
import { BeatmapUtils } from "@domain/osu/utils/BeatmapUtils";
import { scoreBestQueryLimit } from "@domain/osu/configs/Score.config";
import { EApplicationError, Exception } from "@domain/core/Exception";
import {
    EFarmRecommendSort,
    EFarmSort,
    EFarmSortOrder,
    type IFarmMapQuery,
    IFarmRecommendOverrides,
} from "@domain/farm/Farm.types";
import { ICommandDateRange, ICommandMods, ICommandRange } from "@domain/core/Command";
import { AdapterProvider, GameMode } from "@generated/adapter/types";
import { PopulatedUser } from "@domain/osu/Profile.dto";
import { PopulatedScore } from "@domain/osu/Score.dto";
import { FarmRecommendationDto } from "@domain/farm/FarmRecommend.dto";
import { ModUtils } from "@generated/adapter/mods";
import { ScoreUtils } from "@domain/osu/utils/ScoreUtils";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { FarmMapDto } from "@domain/farm/Farm.dto";

interface IFarmRecommendCreateInput {
    nameOrID: string | number;
    mode: GameMode;
    provider: AdapterProvider;
    overrides: IFarmRecommendOverrides;
    count?: number;
}

interface IFarmRecommendCreateResult {
    profile: PopulatedUser;
    query: IFarmMapQuery;
    recommendations: Array<FarmRecommendationDto>;
}

interface IFarmRecommendProfileResult {
    profile: PopulatedUser;
    query: IFarmMapQuery;
}

export class FarmRecommendService extends AbstractService {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly calculatorService: CalculatorService;
    @Import() declare private readonly farmService: FarmService;

    private readonly profileSampleSize = 20;
    private readonly recommendationCount = 6;
    private readonly candidateLimit = 100;

    @Trace()
    public async profile(input: IFarmRecommendCreateInput): Promise<IFarmRecommendProfileResult> {
        const { user, scores } = await this.osuService.userWithScores({
            nameOrID: input.nameOrID,
            mode: input.mode,
            type: "best",
            limit: scoreBestQueryLimit,
            provider: input.provider,
        });

        if (!scores.length) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                "This player has no top plays to build farm recommendations from.",
            );
        }

        const profileScores = await this.osuService.populateAll(
            scores.slice(0, this.profileSampleSize),
            input.mode,
            false,
            input.provider,
        );

        const query = this.buildQuery(
            input.mode,
            profileScores,
            scores.map((score) => score.beatmapID),
            input.overrides,
        );

        return {
            profile: user,
            query,
        };
    }

    @Trace()
    public async create(input: IFarmRecommendCreateInput): Promise<IFarmRecommendCreateResult> {
        const result = await this.profile(input);
        const recommendations = await this.recommend(result.query, input.count ?? this.recommendationCount);

        return {
            ...result,
            recommendations,
        };
    }

    @Trace()
    public async reroll(query: IFarmMapQuery, count = this.recommendationCount): Promise<Array<FarmRecommendationDto>> {
        return this.recommend(this.restoreQueryDates(query), count);
    }

    @Trace()
    public async replace(
        query: IFarmMapQuery,
        current: ReadonlyArray<FarmRecommendationDto>,
        indices: ReadonlyArray<number>,
    ): Promise<Array<FarmRecommendationDto>> {
        const uniqueIndices = [...new Set(indices)]
            .filter((index) => Number.isInteger(index) && index >= 0 && index < current.length)
            .sort((a, b) => a - b);

        if (!uniqueIndices.length) return [...current];

        const replacing = new Set(uniqueIndices);
        const keep = current.filter((_, index) => !replacing.has(index));
        const baseQuery = this.restoreQueryDates(query);

        const replacements = await this.recommend(
            {
                ...baseQuery,
                excludeBeatmapIDs: [
                    ...new Set([...(baseQuery.excludeBeatmapIDs ?? []), ...keep.map((map) => map.beatmapID)]),
                ],
            },
            uniqueIndices.length,
        );

        const result = [...current];
        for (const [replacementIndex, listIndex] of uniqueIndices.entries()) {
            const replacement = replacements[replacementIndex];
            if (!replacement) break;
            result[listIndex] = replacement;
        }

        return result;
    }

    private buildQuery(
        mode: GameMode,
        scores: ReadonlyArray<PopulatedScore<GameMode>>,
        topBeatmapIDs: ReadonlyArray<number>,
        overrides: IFarmRecommendOverrides,
    ): IFarmMapQuery {
        const ppValues = scores.slice(0, 5).map((score) => ScoreUtils.pp(score) || 0);
        const mapSample = scores.slice(0, this.profileSampleSize);

        const bpmValues = mapSample.map((score) => {
            const attrs = score.calculated.difficulty.beatmap;
            return BeatmapUtils.bpm(score.beatmap.bpm, attrs.clockRate);
        });

        const lengthValues = mapSample.map((score) => {
            const attrs = score.calculated.difficulty.beatmap;
            return BeatmapUtils.length(score.beatmap.totalLength, attrs.clockRate);
        });

        const arValues = mapSample.map((score) => score.calculated.difficulty.beatmap.ar);
        const csValues = mapSample.map((score) => score.calculated.difficulty.beatmap.cs);
        const odValues = mapSample.map((score) => score.calculated.difficulty.beatmap.od);
        const hpValues = mapSample.map((score) => score.calculated.difficulty.beatmap.hp);

        return {
            mode,
            pp: overrides.pp ?? this.inferPP(ppValues),
            length: overrides.length ?? this.percentileRange(lengthValues, 5, 0),
            bpm: overrides.bpm ?? this.percentileRange(bpmValues, 5, 0),
            stars: overrides.stars,
            ranked: overrides.ranked,
            ar: overrides.ar ?? this.percentileRange(arValues, 0.25, 0),
            cs: overrides.cs ?? this.percentileRange(csValues, 0.25, 0),
            od: overrides.od ?? this.percentileRange(odValues, 0.25, 0),
            hp: overrides.hp ?? this.percentileRange(hpValues, 0.25, 0),
            mods: overrides.mods ? this.modsQuery(overrides.mods) : undefined,
            excludeBeatmapIDs: [...new Set(topBeatmapIDs)],
            sort: overrides.sort === EFarmRecommendSort.Farmability ? EFarmSort.Farmability : EFarmSort.Random,
            order: EFarmSortOrder.Descending,
        };
    }

    @Trace()
    public async recommendations(
        query: IFarmMapQuery,
        count = this.recommendationCount,
    ): Promise<Array<FarmRecommendationDto>> {
        return this.recommend(query, count);
    }

    private async recommend(query: IFarmMapQuery, count: number): Promise<Array<FarmRecommendationDto>> {
        const wanted = Math.min(Math.max(count, 1), this.recommendationCount);
        const selected = [] as Awaited<ReturnType<FarmService["maps"]>>;
        const selectedBeatmapIDs = new Set<number>();

        for (let pass = 0; pass < 3 && selected.length < wanted; pass++) {
            const candidates = await this.farmService.maps({
                ...query,
                excludeBeatmapIDs: [...new Set([...(query.excludeBeatmapIDs ?? []), ...selectedBeatmapIDs])],
                limit: this.candidateLimit,
                offset: 0,
            });

            if (!candidates.length) break;

            for (const candidate of candidates) {
                if (selectedBeatmapIDs.has(candidate.beatmapID)) continue;
                selected.push(candidate);
                selectedBeatmapIDs.add(candidate.beatmapID);
                if (selected.length >= wanted) break;
            }
        }

        if (!selected.length) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                "No farm maps matched this recommendation profile. Try relaxing one of the filters.",
            );
        }

        return Promise.all(selected.slice(0, wanted).map((map) => this.populate(map, query.mode)));
    }

    private async populate(map: FarmMapDto, mode: GameMode): Promise<FarmRecommendationDto> {
        const mods = ModUtils.fromBits(map.mods);
        const difficulty = await this.calculatorService.difficultyFull(map.beatmapID, mode, mods);
        const attrs = difficulty.beatmap;

        return {
            beatmapID: map.beatmapID,
            mapsetID: map.mapsetID,
            artist: map.artist,
            title: map.title,
            version: map.version,
            mods: map.mods,
            pp: map.pp,
            farmability: map.farmability,
            baseStars: map.stars,
            stars: difficulty.attributes.starRating,
            bpm: map.bpm,
            length: map.length,
            rankedAt: map.rankedAt,
            ar: attrs.ar,
            cs: attrs.cs,
            od: attrs.od,
            hp: attrs.hp,
        };
    }

    private inferPP(values: ReadonlyArray<number>): ICommandRange | undefined {
        const finite = values.filter(Number.isFinite);
        if (!finite.length) return undefined;

        const median = this.percentile(finite, 0.5);
        const strongest = Math.max(...finite);

        return this.inclusiveRange(Math.max(0, Math.floor(median * 0.9)), Math.ceil(strongest * 1.1));
    }

    private percentileRange(
        values: ReadonlyArray<number>,
        minimumPadding: number,
        minimum: number,
    ): ICommandRange | undefined {
        const finite = values.filter(Number.isFinite);
        if (!finite.length) return undefined;

        const lower = this.percentile(finite, 0.2);
        const upper = this.percentile(finite, 0.8);
        const padding = Math.max((upper - lower) * 0.15, minimumPadding);

        return this.inclusiveRange(
            Math.max(minimum, DiscordFormatter.fixed(lower - padding, 0)),
            DiscordFormatter.fixed(upper + padding, 0),
        );
    }

    private percentile(values: ReadonlyArray<number>, percentile: number): number {
        const sorted = [...values].sort((a, b) => a - b);
        if (sorted.length === 1) return sorted[0]!;

        const position = (sorted.length - 1) * percentile;
        const lowerIndex = Math.floor(position);
        const upperIndex = Math.ceil(position);
        const lower = sorted[lowerIndex]!;
        const upper = sorted[upperIndex]!;

        if (lowerIndex === upperIndex) return lower;
        return lower + (upper - lower) * (position - lowerIndex);
    }

    private inclusiveRange(min: number, max: number): ICommandRange {
        return {
            min,
            max,
            minInclusive: true,
            maxInclusive: true,
        };
    }

    private modsQuery(mods: ICommandMods): NonNullable<IFarmMapQuery["mods"]> {
        const bits = ModUtils.isNoMod(mods.mods) ? 0 : ModUtils.toBits(ModUtils.fromString(mods.mods));

        return {
            type: mods.type,
            bits,
        };
    }

    private restoreQueryDates(query: IFarmMapQuery): IFarmMapQuery {
        if (!query.ranked) return query;
        const ranked = query.ranked as ICommandDateRange;

        return {
            ...query,
            ranked: {
                ...ranked,
                min: ranked.min ? new Date(ranked.min) : undefined,
                max: ranked.max ? new Date(ranked.max) : undefined,
                exact: ranked.exact ? new Date(ranked.exact) : undefined,
            },
        };
    }
}
