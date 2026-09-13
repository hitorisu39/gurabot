import { plainToInstance } from "class-transformer";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { FarmMapDto } from "@domain/farm/Farm.dto";
import type { IFarmMapQuery, IFarmMapQueryRow } from "@domain/farm/Farm.types";
import { Trace } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { GameMode } from "@generated/adapter/types";
import { getFarmDatasetQuery, getFarmMapsQuery } from "./queries/Farm.queries";

export class FarmService extends AbstractService {
    private readonly name = "osu-pps";

    @Trace()
    public async maps(query: IFarmMapQuery): Promise<Array<FarmMapDto>> {
        const mode = this.gamemode(query.mode);
        const dataset = await this.repository.farmDataset.findUnique(getFarmDatasetQuery(mode));

        if (!dataset) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} has no farm dataset for this mode`);
        }

        const maps = await this.repository.$queryRaw<Array<IFarmMapQueryRow>>(
            getFarmMapsQuery(dataset.snapshotID, query),
        );

        return plainToInstance(
            FarmMapDto,
            maps.map(({ mapset, effectiveBpm, effectiveLength, effectiveAr, ...map }) => ({
                ...map,
                ...mapset,
                bpm: effectiveBpm,
                length: effectiveLength,
                ar: effectiveAr,
            })),
            { excludeExtraneousValues: true },
        );
    }

    private gamemode(mode: GameMode): number {
        switch (mode) {
            case GameMode.Standard:
                return 0;
            case GameMode.Taiko:
                return 1;
            case GameMode.Catch:
                return 2;
            case GameMode.Mania:
                return 3;
        }
    }
}
