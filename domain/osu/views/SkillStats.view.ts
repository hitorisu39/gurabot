import { PopulatedUser } from "../Profile.dto";
import { PopulatedScore } from "../Score.dto";
import { SkillCategoryResultDto } from "../Skill.dto";
import { ESkillType } from "../enums/Skill.enum";
import { Exclude, Expose, Type } from "class-transformer";

export enum ESkillStatsView {
    Overview = "Overview",
}

export type TSkillStatsView = ESkillStatsView | ESkillType;

@Exclude()
export class SkillStatsViewDto {
    @Expose()
    declare authorID: string;

    @Expose()
    declare timestamp: number;

    @Expose()
    @Type(() => PopulatedUser)
    declare profile: PopulatedUser;

    @Expose()
    @Type(() => SkillCategoryResultDto)
    declare categories: Array<SkillCategoryResultDto>;

    @Expose()
    @Type(() => PopulatedScore)
    declare scores: Array<PopulatedScore>;

    @Expose()
    declare view: TSkillStatsView;

    @Expose()
    declare page: number;
}
