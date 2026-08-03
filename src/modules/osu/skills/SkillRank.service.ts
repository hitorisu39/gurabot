import { AbstractService } from "@/core/framework/AbstractService";
import { skillRankThresholds, skillRankWeights } from "@domain/osu/configs/Skill.config";
import { ESkillRank, ESkillType } from "@domain/osu/enums/Skill.enum";
import { SkillCategoryResultDto, SkillRankDto } from "@domain/osu/Skill.dto";
import { GameMode } from "@generated/adapter/types";

export class SkillRankService extends AbstractService {
    public calculate(mode: GameMode, categories: Array<SkillCategoryResultDto>): SkillRankDto {
        const value = this.calculateTotalValue(mode, categories);

        for (let index = skillRankThresholds.length - 1; index >= 0; index--) {
            const threshold = skillRankThresholds[index];

            if (threshold && value >= threshold.threshold) {
                return {
                    rank: threshold.rank,
                    index,
                    threshold: threshold.threshold,
                    value,
                };
            }
        }

        return {
            rank: ESkillRank.Weak,
            index: 0,
            threshold: 0,
            value,
        };
    }

    public calculateTotalValue(mode: GameMode, categories: Array<SkillCategoryResultDto>): number {
        const weights = skillRankWeights[mode];
        const values = new Map<ESkillType, number>();

        for (const category of categories) {
            values.set(category.type, category.average);
        }

        let total = 0;

        for (const [type, weight] of Object.entries(weights) as Array<[ESkillType, number]>) {
            const value = values.get(type);

            if (value !== undefined && Number.isFinite(value)) {
                total += value * weight;
            }
        }

        return total;
    }
}
