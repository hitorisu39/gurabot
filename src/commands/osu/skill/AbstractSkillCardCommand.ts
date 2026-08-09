import { Category, Examples, Help, Import } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { SkillCardViewService } from "@/modules/osu/skills/SkillCardView.service";
import { AbstractSkillCommand } from "./AbstractSkillCommand";
import { ECommandCategory } from "@domain/core/Command";

@Help(`
    Generates a skill card from the specified player's top 100 plays.
`)
@Examples("skillcard", "card mrekk", "maniacard dressurf")
@Category(ECommandCategory.Osu)
export abstract class AbstractSkillCardCommand extends AbstractSkillCommand {
    @Import() declare private readonly skillCardViewService: SkillCardViewService;

    public async execute(ctx: CommandContext): Promise<void> {
        const data = await this.createSkillData(ctx);
        await ctx.respond(await this.skillCardViewService.build(data));
    }
}
