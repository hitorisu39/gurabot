import { ESkillRank, ESkillType } from "./enums/Skill.enum";
import { PopulatedScore } from "./Score.dto";
import { Exclude, Expose, Type } from "class-transformer";

@Exclude()
export class SkillScoreResultDto {
    @Expose()
    @Type(() => PopulatedScore)
    declare score: PopulatedScore;

    @Expose()
    declare value: number;
}

@Exclude()
export class SkillCategoryResultDto {
    @Expose()
    declare type: ESkillType;

    @Expose()
    declare label: string;

    @Expose()
    declare average: number;

    @Expose()
    @Type(() => SkillScoreResultDto)
    declare topScores: Array<SkillScoreResultDto>;
}

@Exclude()
export class SkillCalculationResultDto {
    @Expose()
    @Type(() => SkillCategoryResultDto)
    declare categories: Array<SkillCategoryResultDto>;
}

@Exclude()
export class SkillRankDto {
    @Expose()
    declare rank: ESkillRank;

    @Expose()
    declare index: number;

    @Expose()
    declare threshold: number;

    @Expose()
    declare value: number;
}
