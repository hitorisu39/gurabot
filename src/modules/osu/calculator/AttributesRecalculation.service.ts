// src/modules/osu/calculator/AttributesRecalculation.service.ts
import { AbstractService } from "@/core/framework/AbstractService";
import { Import } from "@/core/decorators";
import { CalculatorMapService } from "./CalculatorMap.service";
import { GameMode } from "@generated/adapter/types";
import { ModUtils, ParsedMod } from "@generated/adapter/mods";
import { wait } from "@domain/utils";

export interface IRecalculationStatus {
    isRunning: boolean;
    total: number;
    processed: number;
    startTime: number;
}

export class AttributesRecalculationService extends AbstractService {
    @Import() declare private readonly calculatorMapService: CalculatorMapService;

    private isRunning: boolean = false;
    private total: number = 0;
    private processed: number = 0;
    private startTime: number = 0;

    public getStatus(): IRecalculationStatus {
        return {
            isRunning: this.isRunning,
            total: this.total,
            processed: this.processed,
            startTime: this.startTime,
        };
    }

    public start(date: Date | null, force: boolean, noCustom: boolean): void {
        if (this.isRunning) return;

        this.isRunning = true;
        this.startTime = Date.now();
        this.total = 0;
        this.processed = 0;

        this.runBackgroundJob(date, force, noCustom).catch((err) => {
            this.logger.error(err, "Attributes recalculation job encountered a fatal error.");
        }).finally(() => {
            this.isRunning = false;
        });
    }

    private async runBackgroundJob(date: Date | null, force: boolean, noCustom: boolean): Promise<void> {
        const whereClause: any = {};
        if (!force && date) {
            whereClause.updatedAt = { lt: date };
        }

        const tables = [
            { mode: GameMode.Standard, delegate: this.repository.standardDifficultyAttributes },
            { mode: GameMode.Taiko, delegate: this.repository.taikoDifficultyAttributes },
            { mode: GameMode.Catch, delegate: this.repository.catchDifficultyAttributes },
            { mode: GameMode.Mania, delegate: this.repository.maniaDifficultyAttributes },
        ];

        if (noCustom) {
            for (const table of tables) {
                const res = await (table.delegate as any).deleteMany({
                    where: { ...whereClause, custom: true },
                });
                
                this.total += res.count;
                this.processed += res.count;
            }
        }

        for (const table of tables) {
            const queryWhere = noCustom ? { ...whereClause, custom: false } : whereClause;
            this.total += await (table.delegate as any).count({ where: queryWhere });
        }

        if (this.total === 0) return;

        const batchSize = 50;

        for (const table of tables) {
            const queryWhere = noCustom ? { ...whereClause, custom: false } : whereClause;
            let offset = 0;

            while (this.isRunning) {
                const batch = await (table.delegate as any).findMany({
                    where: queryWhere,
                    take: batchSize,
                    skip: offset,
                    orderBy: [{ beatmapID: "asc" }, { mods: "asc" }],
                });

                if (batch.length === 0) break;

                let failedCount = 0;

                await Promise.all(
                    batch.map(async (record: any) => {
                        try {
                            await this.calculatorMapService.download(record.beatmapID);
                            const parsedMods = this.parseModsString(record.mods);

                            const protoMods = parsedMods.map((m) => ({
                                acronym: m.acronym,
                                settings: m.settings 
                                    ? Object.fromEntries(Object.entries(m.settings).map(([k, v]) => [k, String(v)]))
                                    : {}
                            }));

                            const response = await this.calculator.difficulty({
                                mode: table.mode,
                                beatmapPath: this.calculatorMapService.getPath(record.beatmapID),
                                mods: protoMods,
                            });

                            await (table.delegate as any).update({
                                where: { beatmapID_mods: { beatmapID: record.beatmapID, mods: record.mods } },
                                data: { ...response.attributes, updatedAt: new Date() },
                            });
                        } catch (err) {
                            this.logger.error(err, `Failed to recalculate beatmap ${record.beatmapID}`);
                            failedCount++;
                        } finally {
                            this.processed++;
                        }
                    })
                );

                if (force) {
                    offset += batch.length;
                } else {
                    offset += failedCount;
                }

                await wait(1000);
            }
        }
    }

    private parseModsString(modsString: string): Array<ParsedMod> {
        if (modsString === "NM" || !modsString) return [];
        
        const regex = /([a-zA-Z0-9]{2,4})(?:\(([^)]+)\))?/g;
        const extracted: Array<{ acronym: string, settings?: Record<string, any> }> = [];
        let match;

        while ((match = regex.exec(modsString)) !== null) {
            const acronym = match[1]!;
            const settingsStr = match[2];
            let settings: Record<string, any> | undefined = undefined;

            if (settingsStr) {
                settings = {};
                settingsStr.split(",").forEach((kv) => {
                    const [k, v] = kv.split("=");
                    settings![k!] = isNaN(Number(v)) ? v : Number(v);
                });
            }

            extracted.push({ acronym, settings });
        }

        return ModUtils.parse(extracted);
    }
}