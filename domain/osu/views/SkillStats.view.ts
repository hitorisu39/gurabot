import { PopulatedUser } from "../Profile.dto";
import { SkillCategoryResultDto } from "../Skill.dto";
import { Exclude, Expose, Type } from "class-transformer";

@Exclude()
export class SkillStatsViewDto {
    @Expose()
    declare timestamp: number;

    @Expose()
    @Type(() => PopulatedUser)
    declare profile: PopulatedUser;

    @Expose()
    @Type(() => SkillCategoryResultDto)
    declare categories: Array<SkillCategoryResultDto>;
}
