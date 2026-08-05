import { Score } from "@generated/adapter/types";
import { ScoreWithMaps } from "@domain/osu/Score.dto";
import { ScoreUtils } from "./ScoreUtils";

export interface IFarmMapper {
    id: number;
    name: string;
}

export interface IFarmMapperCount {
    mapper: IFarmMapper;
    count: number;
}

export interface IFarmerRank {
    name: string;
    message: string;
}

export interface IFarmerAnalysis {
    totalCount: number;
    mapperCounts: Array<IFarmMapperCount>;
    rank: IFarmerRank;
}

/**
 * Last updated: 2026/08/05
 */
export const farmMappers: ReadonlyArray<IFarmMapper> = [
    { id: 4452992, name: "Sotarks" },
    { id: 10527102, name: "Kumocha" },
    { id: 5404892, name: "kowari" },
    { id: 8357007, name: "My Angel Ram" },
    { id: 13216706, name: "gwb" },
    { id: 4175698, name: "sytho" },
    { id: 10077431, name: "plambob" },
    { id: 16004080, name: "Tylerderp" },
    { id: 9180442, name: "PikAqours" },
    { id: 9320502, name: "Astronic" },
    { id: 20793704, name: "h6zy" },
    { id: 8508753, name: "maaadbot" },
    { id: 14729352, name: "nebuwua" },
    { id: 19111992, name: "Urition" },
    { id: 2732340, name: "Taeyang" },
    { id: 3533958, name: "fieryrage" },
    { id: 3723568, name: "Reform" },
    { id: 9426712, name: "browiec" },
    { id: 6174349, name: "Kuki1537" },
    { id: 4378277, name: "Log Off Now" },
    { id: 2185987, name: "emu1337" },
    { id: 5115995, name: "A r M i N" },
    { id: 22882379, name: "Mita" },
];

export class FarmerEvaluator {
    /**
     * Legacy code put a hardcap of 2 minutes for the sake of not including long maps
     * which might be not farm/good maps.
     */
    private static readonly maximumFarmMapLength = 120;

    private readonly mappersByID: ReadonlyMap<number, IFarmMapper>;
    private readonly mappersByName: ReadonlyMap<string, IFarmMapper>;

    public constructor(private readonly mappers: ReadonlyArray<IFarmMapper> = farmMappers) {
        this.mappersByID = new Map(mappers.map((mapper) => [mapper.id, mapper]));
        this.mappersByName = new Map(mappers.map((mapper) => [this.normalizeName(mapper.name), mapper]));
    }

    public evaluate(scores: ReadonlyArray<Score>): IFarmerAnalysis {
        const counts = new Map<number, number>();
        let totalCount = 0;

        for (const score of scores) {
            if (!ScoreUtils.hasMaps(score)) {
                continue;
            }

            if (!this.isShortMap(score)) {
                continue;
            }

            const mapper = this.resolveMapper(score);
            if (!mapper) {
                continue;
            }

            counts.set(mapper.id, (counts.get(mapper.id) ?? 0) + 1);
            totalCount++;
        }

        const mapperCounts = this.mappers
            .map((mapper) => ({
                mapper,
                count: counts.get(mapper.id) ?? 0,
            }))
            .filter(({ count }) => count > 0);

        return {
            totalCount,
            mapperCounts,
            rank: this.getRank(totalCount),
        };
    }

    private isShortMap(score: ScoreWithMaps): boolean {
        return score.beatmap.hitLength < FarmerEvaluator.maximumFarmMapLength;
    }

    private resolveMapper(score: ScoreWithMaps): IFarmMapper | undefined {
        const beatmap = score.beatmap;
        const beatmapset = score.beatmapset;

        if (beatmap.userID) {
            const mapper = this.mappersByID.get(beatmap.userID);
            if (mapper) {
                return mapper;
            }
        }

        return this.mappersByName.get(this.normalizeName(beatmapset.creator));
    }

    private getRank(count: number): IFarmerRank {
        if (count < 5) {
            return {
                name: "Agricultural Intern",
                message: "You have touched the crops, but the crops have not yet claimed you.",
            };
        }

        if (count < 10) {
            return {
                name: "Weekend Wheat Enthusiast",
                message: "A little farming never hurt anyone. Probably.",
            };
        }

        if (count < 20) {
            return {
                name: "Certified PP Harvester",
                message: "The fields are looking suspiciously optimized.",
            };
        }

        if (count < 35) {
            return {
                name: "Sotarks' Strongest Soldier",
                message: "You no longer choose the farm maps. The farm maps choose you.",
            };
        }

        if (count < 50) {
            return {
                name: "Industrial Combo Farmer",
                message: "Your top plays qualify for agricultural subsidies.",
            };
        }

        if (count < 75) {
            return {
                name: "Chairman of Big Farming",
                message: "The local economy now depends entirely on your retry button.",
            };
        }

        if (count < 100) {
            return {
                name: "Sentient PP Plantation",
                message: "You are no longer playing farm maps. You are part of the infrastructure.",
            };
        }

        return {
            name: "The Final Boss of Agriculture",
            message: "The fields whisper your username. Every jump pattern bends toward your cursor.",
        };
    }

    private normalizeName(name: string): string {
        return name.trim().toLowerCase();
    }
}
