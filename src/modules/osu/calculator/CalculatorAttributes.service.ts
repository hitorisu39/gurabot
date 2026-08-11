import { AbstractService } from "@/core/framework/AbstractService";
import { GameMode } from "@generated/adapter/types";
import { IDifficultyCalculationResponse, TDifficultyAttributes } from "@domain/core/Calculator";
import { Import } from "@/core/decorators";
import { CalculatorMapService } from "./CalculatorMap.service";
import { ModUtils, ParsedMod } from "@generated/adapter/mods";

export class CalculatorAttributesService extends AbstractService {
    @Import() declare private readonly calculatorMapService: CalculatorMapService;

    //#region API

    public async get<M extends GameMode>(
        beatmapID: number,
        mode: M,
        mods: Array<ParsedMod>,
        clockRate?: number,
    ): Promise<TDifficultyAttributes<M>> {
        const { cacheString, custom } = this.getModCacheString(mods, clockRate);

        const cached = await this.getFromDatabase(beatmapID, mode, cacheString);
        if (cached) return cached as TDifficultyAttributes<M>;
        
        const protoMods = mods.map((m) => ({
            acronym: m.acronym,
            settings: m.settings 
                ? Object.fromEntries(Object.entries(m.settings).map(([k, v]) => [k, String(v)]))
                : {}
        }));

        const response = await this.calculator.difficulty({
            mode,
            beatmapPath: this.calculatorMapService.getPath(beatmapID),
            mods: protoMods,
            clockRate
        });

        await this.saveToDatabase(beatmapID, mode, cacheString, response.attributes, custom);

        return response.attributes;
    }

    public async getWithStrains<M extends GameMode>(
        beatmapID: number,
        mode: M,
        mods: Array<ParsedMod>,
        clockRate?: number,
        strainPointLimit?: number,
    ): Promise<IDifficultyCalculationResponse<M>> {
        const { cacheString, custom } = this.getModCacheString(mods, clockRate);

        const protoMods = mods.map((m) => ({
            acronym: m.acronym,
            settings: m.settings 
                ? Object.fromEntries(Object.entries(m.settings).map(([k, v]) => [k, String(v)]))
                : {}
        }));

        const response = await this.calculator.difficulty({
            mode,
            beatmapPath: this.calculatorMapService.getPath(beatmapID),
            mods: protoMods,
            clockRate,
            calculateStrains: true,
            strainPointLimit
        });

        await this.saveToDatabase(beatmapID, mode, cacheString, response.attributes, custom);
        return response;
    }

    public async getMany<M extends GameMode>(
        requests: Array<{
            beatmapID: number;
            mode: M;
            mods: Array<ParsedMod>;
        }>,
    ): Promise<Map<string, TDifficultyAttributes<M>>> {
        const resultMap = new Map<string, TDifficultyAttributes<M>>();

        const uniqueRequests = new Map<
            string,
            {
                beatmapID: number;
                mode: M;
                mods: Array<ParsedMod>;
                cacheString: string;
                custom: boolean;
            }
        >();

        for (const request of requests) {
            const { cacheString, custom } = this.identity(request.mods);
            const key = this.key(
                request.beatmapID,
                request.mode,
                request.mods,
            );

            if (!uniqueRequests.has(key)) {
                uniqueRequests.set(key, {
                    ...request,
                    cacheString,
                    custom,
                });
            }
        }

        const fetched = await Promise.all(
            [...uniqueRequests.entries()].map(async ([key, request]) => {
                const cached = await this.getFromDatabase(
                    request.beatmapID,
                    request.mode,
                    request.cacheString,
                );

                return {
                    key,
                    request,
                    cached: cached as TDifficultyAttributes<M> | null,
                };
            }),
        );

        await Promise.all(
            fetched.map(async ({ key, request, cached }) => {
                if (cached) {
                    resultMap.set(key, cached);
                    return;
                }

                const protoMods = request.mods.map((mod) => ({
                    acronym: mod.acronym,
                    settings: mod.settings
                        ? Object.fromEntries(
                            Object.entries(mod.settings).map(
                                ([setting, value]) => [
                                    setting,
                                    String(value),
                                ],
                            ),
                        )
                        : {},
                }));

                const response = await this.calculator.difficulty({
                    mode: request.mode,
                    beatmapPath: this.calculatorMapService.getPath(
                        request.beatmapID,
                    ),
                    mods: protoMods,
                });

                await this.saveToDatabase(
                    request.beatmapID,
                    request.mode,
                    request.cacheString,
                    response.attributes,
                    request.custom,
                );

                resultMap.set(key, response.attributes);
            }),
        );

        return resultMap;
    }

    public identity(
        mods: ReadonlyArray<ParsedMod>,
        clockRate?: number,
    ): { cacheString: string; custom: boolean } {
        return this.getModCacheString([...mods], clockRate);
    }

    public key(
        beatmapID: number,
        mode: GameMode,
        mods: ReadonlyArray<ParsedMod>,
        clockRate?: number,
    ): string {
        const { cacheString } = this.identity(mods, clockRate);

        return `${beatmapID}:${mode}:${cacheString}`;
    }

    //#endregion

    //#region Internal

    private getModCacheString(
        mods: Array<ParsedMod>,
        clockRate?: number,
    ): { cacheString: string; custom: boolean } {
        const perfMods = ModUtils.difficultyAffecting(mods);
        let custom = false;

        let cacheString =
            perfMods.length === 0
                ? "NM"
                : perfMods
                    .map((mod) => {
                        if (!mod.settings || Object.keys(mod.settings).length === 0) {
                            return mod.acronym;
                        }

                        custom = true;

                        const settings = Object.entries(mod.settings)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([key, value]) => `${key}=${value}`)
                            .join(",");

                        return `${mod.acronym}(${settings})`;
                    })
                    .sort()
                    .join("");

        if (clockRate !== undefined) {
            custom = true;
            cacheString += `@${clockRate.toFixed(6)}x`;
        }

        return { cacheString, custom };
    }

    private async getFromDatabase<M extends GameMode>(
        beatmapID: number,
        mode: M,
        mods: string
    ): Promise<any | null> {
        const where = { beatmapID_mods: { beatmapID, mods } };
        let result: any;

        switch (mode) {
            case GameMode.Standard:
                result = await this.repository.standardDifficultyAttributes.findUnique({ where });
                break;
            case GameMode.Taiko:
                result = await this.repository.taikoDifficultyAttributes.findUnique({ where });
                break;
            case GameMode.Catch:
                result = await this.repository.catchDifficultyAttributes.findUnique({ where });
                break;
            case GameMode.Mania:
                result = await this.repository.maniaDifficultyAttributes.findUnique({ where });
                break;
            default:
                return null;
        }

        if (result) {
            delete result.beatmapID;
            delete result.mods;
            delete result.custom;
        }

        return result;
    }

    private async saveToDatabase<M extends GameMode>(
        beatmapID: number,
        mode: M,
        mods: string,
        attributes: TDifficultyAttributes<M>,
        custom?: boolean
    ): Promise<void> {
        const where = { beatmapID_mods: { beatmapID, mods } };
        
        switch (mode) {
            case GameMode.Standard:
                await this.repository.standardDifficultyAttributes.upsert({
                    where,
                    update: {},
                    create: { beatmapID, mods, custom, ...(attributes as any) }
                });
                break;
            case GameMode.Taiko:
                await this.repository.taikoDifficultyAttributes.upsert({
                    where,
                    update: {},
                    create: { beatmapID, mods, custom, ...(attributes as any) }
                });
                break;
            case GameMode.Catch:
                await this.repository.catchDifficultyAttributes.upsert({
                    where,
                    update: {},
                    create: { beatmapID, mods, custom, ...(attributes as any) }
                });
                break;
            case GameMode.Mania:
                await this.repository.maniaDifficultyAttributes.upsert({
                    where,
                    update: {},
                    create: { beatmapID, mods, custom, ...(attributes as any) }
                });
                break;
        }
    }

    //#endregion
}