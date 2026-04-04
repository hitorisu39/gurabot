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
        mods: Array<ParsedMod>
    ): Promise<TDifficultyAttributes<M>> {
        const { cacheString, custom } = this.getModCacheString(mods);

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
            mods: protoMods
        });

        await this.saveToDatabase(beatmapID, mode, cacheString, response.attributes, custom);

        return response.attributes;
    }

    public async getWithStrains<M extends GameMode>(
        beatmapID: number,
        mode: M,
        mods: Array<ParsedMod>
    ): Promise<IDifficultyCalculationResponse<M>> {
        const { cacheString, custom } = this.getModCacheString(mods);

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
            calculateStrains: true
        });

        await this.saveToDatabase(beatmapID, mode, cacheString, response.attributes, custom);
        return response;
    }

    public async getMany<M extends GameMode>(
        requests: Array<{ beatmapID: number; mode: M; mods: Array<ParsedMod> }>
    ): Promise<Map<string, TDifficultyAttributes<M>>> {
        const resultMap = new Map<string, TDifficultyAttributes<M>>();
        const uniqueRequests = new Map<string, { beatmapID: number; mode: M; mods: Array<ParsedMod>; cacheString: string; custom: boolean }>();

        for (const req of requests) {
            const { cacheString, custom } = this.getModCacheString(req.mods);
            const dedupKey = `${req.beatmapID}_${cacheString}`;
            
            if (!uniqueRequests.has(dedupKey)) {
                uniqueRequests.set(dedupKey, { ...req, cacheString, custom });
            }
        }

        const fetchPromises = Array.from(uniqueRequests.values()).map(async (req) => {
            const cached = await this.getFromDatabase(req.beatmapID, req.mode, req.cacheString);
            return { req, cached: cached as TDifficultyAttributes<M> | null };
        });

        const fetchResults = await Promise.all(fetchPromises);

        const calculatePromises = fetchResults.map(async ({ req, cached }) => {
            const key = `${req.beatmapID}_${req.cacheString}`;

            if (cached) {
                resultMap.set(key, cached);
                return;
            }

            const protoMods = req.mods.map(m => ({
                acronym: m.acronym,
                settings: m.settings ? Object.fromEntries(Object.entries(m.settings).map(([k, v]) => [k, String(v)])) : {}
            }));

            const response = await this.calculator.difficulty({
                mode: req.mode,
                beatmapPath: this.calculatorMapService.getPath(req.beatmapID),
                mods: protoMods
            });

            await this.saveToDatabase(req.beatmapID, req.mode, req.cacheString, response.attributes, req.custom);

            resultMap.set(key, response.attributes);
        });

        await Promise.all(calculatePromises);
        return resultMap;
    }

    //#endregion

    //#region Internal

    private getModCacheString(mods: Array<ParsedMod>): { cacheString: string, custom: boolean } {
        const perfMods = ModUtils.difficultyAffecting(mods);
        let custom = false;

        if (perfMods.length === 0) {
            return { cacheString: "NM", custom };
        }

        const cacheString = perfMods.map(m => {
            if (!m.settings || Object.keys(m.settings).length === 0) {
                return m.acronym;
            }
            
            custom = true;
            const settingsStr = Object.entries(m.settings)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => `${k}=${v}`)
                .join(',');
                
            return `${m.acronym}(${settingsStr})`;
        }).sort().join("");

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