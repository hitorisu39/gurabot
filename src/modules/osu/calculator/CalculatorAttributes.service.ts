import { AbstractService } from "@/core/framework/AbstractService";
import { GameMode } from "@generated/adapter/types";
import { IDifficultyCalculationResponse, TDifficultyAttributes, toCalculatorMods } from "@domain/core/Calculator";
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
        const response = await this.getFull(beatmapID, mode, mods, clockRate);
        return response.attributes;
    }

    public async getFull<M extends GameMode>(
        beatmapID: number,
        mode: M,
        mods: Array<ParsedMod>,
        clockRate?: number,
    ): Promise<IDifficultyCalculationResponse<M>> {
        const { cacheString, custom } = this.getModCacheString(mods, clockRate);

        const cached = await this.getFromDatabase(beatmapID, mode, cacheString);
        if (cached) {
            return cached;
        }

        const response = await this.calculator.difficulty({
            mode,
            beatmapPath: this.calculatorMapService.getPath(beatmapID),
            mods: toCalculatorMods(mods),
            clockRate,
        });

        await this.saveToDatabase(beatmapID, mode, cacheString, response, custom);
        return response;
    }

    public async getWithStrains<M extends GameMode>(
        beatmapID: number,
        mode: M,
        mods: Array<ParsedMod>,
        clockRate?: number,
        strainPointLimit?: number,
    ): Promise<IDifficultyCalculationResponse<M>> {
        const { cacheString, custom } = this.getModCacheString(mods, clockRate);
        const response = await this.calculator.difficulty({
            mode,
            beatmapPath: this.calculatorMapService.getPath(beatmapID),
            mods: toCalculatorMods(mods),
            clockRate,
            calculateStrains: true,
            strainPointLimit,
        });

        await this.saveToDatabase(beatmapID, mode, cacheString, response, custom);
        return response;
    }

    public async getMany<M extends GameMode>(
        requests: Array<{ beatmapID: number; mode: M; mods: Array<ParsedMod> }>,
    ): Promise<Map<string, TDifficultyAttributes<M>>> {
        const responses = await this.getManyFull(requests);
        return new Map([...responses.entries()].map(([key, response]) => [key, response.attributes]));
    }

    public async getManyFull<M extends GameMode>(
        requests: Array<{
            beatmapID: number;
            mode: M;
            mods: Array<ParsedMod>;
        }>,
    ): Promise<Map<string, IDifficultyCalculationResponse<M>>> {
        const uniqueRequests = new Map<string, { beatmapID: number; mode: M; mods: Array<ParsedMod> }>();

        for (const request of requests) {
            const key = this.key(request.beatmapID, request.mode, request.mods);
            if (!uniqueRequests.has(key)) {
                uniqueRequests.set(key, request);
            }
        }

        const entries = await Promise.all(
            [...uniqueRequests.entries()].map(async ([key, request]) => {
                const response = await this.getFull(request.beatmapID, request.mode, request.mods);
                return [key, response] as const;
            }),
        );

        return new Map(entries);
    }

    public identity(mods: ReadonlyArray<ParsedMod>, clockRate?: number): { cacheString: string; custom: boolean } {
        return this.getModCacheString([...mods], clockRate);
    }

    public key(beatmapID: number, mode: GameMode, mods: ReadonlyArray<ParsedMod>, clockRate?: number): string {
        const { cacheString } = this.identity(mods, clockRate);
        return `${beatmapID}:${mode}:${cacheString}`;
    }

    //#endregion

    //#region Internal

    private getModCacheString(mods: Array<ParsedMod>, clockRate?: number): { cacheString: string; custom: boolean } {
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
        mods: string,
    ): Promise<IDifficultyCalculationResponse<M> | null> {
        const where = {
            beatmapID_mods: {
                beatmapID,
                mods,
            },
        };

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

        if (!result) {
            return null;
        }

        const {
            beatmapID: _beatmapID,
            mods: _mods,
            custom: _custom,
            createdAt: _createdAt,
            updatedAt: _updatedAt,

            ar,
            od,
            cs,
            hp,
            clockRate,

            ...attributes
        } = result;

        return {
            attributes: attributes as TDifficultyAttributes<M>,
            beatmap: {
                ar,
                od,
                cs,
                hp,
                clockRate,
            },
        };
    }

    private async saveToDatabase<M extends GameMode>(
        beatmapID: number,
        mode: M,
        mods: string,
        difficulty: IDifficultyCalculationResponse<M>,
        custom: boolean,
    ): Promise<void> {
        const where = {
            beatmapID_mods: {
                beatmapID,
                mods,
            },
        };

        const data = {
            beatmapID,
            mods,
            custom,

            ...difficulty.attributes,

            ar: difficulty.beatmap.ar,
            od: difficulty.beatmap.od,
            cs: difficulty.beatmap.cs,
            hp: difficulty.beatmap.hp,
            clockRate: difficulty.beatmap.clockRate,
        };

        switch (mode) {
            case GameMode.Standard:
                await this.repository.standardDifficultyAttributes.upsert({
                    where,
                    update: {},
                    create: data as any,
                });
                break;
            case GameMode.Taiko:
                await this.repository.taikoDifficultyAttributes.upsert({
                    where,
                    update: {},
                    create: data as any,
                });
                break;
            case GameMode.Catch:
                await this.repository.catchDifficultyAttributes.upsert({
                    where,
                    update: {},
                    create: data as any,
                });
                break;
            case GameMode.Mania:
                await this.repository.maniaDifficultyAttributes.upsert({
                    where,
                    update: {},
                    create: data as any,
                });
                break;
        }
    }

    //#endregion
}
