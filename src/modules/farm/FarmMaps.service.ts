import { Import, Trace } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { CalculatorService } from "@/modules/osu/calculator/Calculator.service";
import { FarmService } from "@/modules/farm/Farm.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import type { ICommandDateRange } from "@domain/core/Command";
import type { IFarmMapQuery } from "@domain/farm/Farm.types";
import { GameMode } from "@generated/adapter/types";
import { FarmMapsViewDto } from "@domain/farm/views/FarmMaps.view";
import { farmMapsPageSize } from "@domain/farm/configs/Farm.config";
import { FarmMapsMapDto } from "@domain/farm/FarmMaps.dto";
import { ModUtils } from "@generated/adapter/mods";

export class FarmMapsService extends AbstractService {
    @Import() declare private readonly farmService: FarmService;
    @Import() declare private readonly calculatorService: CalculatorService;

    @Trace()
    public async populatePage(data: FarmMapsViewDto): Promise<void> {
        const query = this.restoreQueryDates(data.query);
        const offset = (data.page - 1) * farmMapsPageSize;

        const rows = await this.farmService.maps({
            ...query,
            limit: farmMapsPageSize + 1,
            offset,
        });

        const hasNext = rows.length > farmMapsPageSize;
        const pageRows = rows.slice(0, farmMapsPageSize);

        if (!pageRows.length) {
            if (data.page === 1) {
                throw new Exception(EApplicationError.NOT_FOUND, "No farm maps matched these filters.");
            }

            data.page = Math.max(1, data.page - 1);
            data.lastPage = data.page;
            return this.populatePage(data);
        }

        data.maps = await Promise.all(pageRows.map((map) => this.populateMap(map, data.mode)));

        if (!hasNext) {
            data.lastPage = data.page;
        }
    }

    private async populateMap(
        map: Awaited<ReturnType<FarmService["maps"]>>[number],
        mode: GameMode,
    ): Promise<FarmMapsMapDto> {
        const mods = ModUtils.fromBits(map.mods);
        const difficulty = await this.calculatorService.difficultyFull(map.beatmapID, mode, mods);
        const attrs = difficulty.beatmap;

        return Object.assign(new FarmMapsMapDto(), {
            beatmapID: map.beatmapID,
            mapsetID: map.mapsetID,
            artist: map.artist,
            title: map.title,
            version: map.version,
            mods: map.mods,
            pp: map.pp,
            farmability: map.farmability,
            stars: difficulty.attributes.starRating,
            bpm: map.bpm,
            length: map.length,
            rankedAt: map.rankedAt,
            ar: attrs.ar,
            cs: attrs.cs,
            od: attrs.od,
            hp: attrs.hp,
        });
    }

    private restoreQueryDates(query: IFarmMapQuery): IFarmMapQuery {
        if (!query.ranked) {
            return query;
        }

        const ranked = query.ranked as ICommandDateRange & {
            min?: Date | string;
            max?: Date | string;
            exact?: Date | string;
        };

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
