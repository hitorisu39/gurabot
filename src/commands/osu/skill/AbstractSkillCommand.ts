import { Category, Import } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { SkillStatsViewDto } from "@domain/osu/views/SkillStats.view";
import { ProviderMeta } from "@generated/adapter";
import { OsuService } from "@/modules/osu/Osu.service";
import { SkillCalculatorService } from "@/modules/osu/skills/SkillCalculator.service";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { ECommandCategory } from "@domain/core/Command";
import { scoreFetchBestLimit } from "@domain/osu/configs/Score.config";

@Category(ECommandCategory.Osu)
export abstract class AbstractSkillCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly skillCalculatorService: SkillCalculatorService;

    protected async createSkillData(ctx: CommandContext): Promise<SkillStatsViewDto> {
        const target = await this.resolveTarget(ctx);

        const { user, scores } = await this.osuService.userWithScores({
            nameOrID: target.query,
            mode: target.mode,
            type: "best",
            limit: scoreFetchBestLimit,
            provider: target.server,
        });

        if (!scores.length) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                `No top plays found for **${user.username}** on ${ProviderMeta[target.server].name}.`,
            );
        }

        const populated = await this.osuService.populateAll(scores, target.mode, false, target.server);

        if (!populated.length) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                `The top plays for **${user.username}** could not be populated.`,
            );
        }

        const result = this.skillCalculatorService.calculate(target.mode, populated);
        const hasValidSkills = result.categories.some((category) => category.topScores.length > 0);

        if (!hasValidSkills) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "No valid skill values could be calculated from this player's top plays.",
            );
        }

        return {
            timestamp: Date.now(),
            profile: user,
            categories: result.categories,
        };
    }
}
