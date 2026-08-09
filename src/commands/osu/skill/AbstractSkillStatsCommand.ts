import { Category, Examples, Help, Import } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { SkillStatsViewService } from "@/modules/osu/skills/SkillStatsView.service";
import { AbstractSkillCommand } from "./AbstractSkillCommand";
import { ECommandCategory } from "@domain/core/Command";

@Help(`
    Calculates skill statistics from the specified player's top 100 plays.
`)
@Examples("skills", "skills mrekk")
@Category(ECommandCategory.Osu)
export abstract class AbstractSkillStatsCommand extends AbstractSkillCommand {
    @Import() declare private readonly skillStatsViewService: SkillStatsViewService;

    public async execute(ctx: CommandContext): Promise<void> {
        const data = await this.createSkillData(ctx);
        await ctx.respond(this.skillStatsViewService.build(data));
    }
}
