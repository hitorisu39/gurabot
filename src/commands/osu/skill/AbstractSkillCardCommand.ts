import { Category, Examples, Help, Import } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { SkillCardViewService } from "@/modules/osu/skills/SkillCardView.service";
import { AbstractSkillCommand } from "./AbstractSkillCommand";
import { ECommandCategory } from "@domain/core/Command";

@Help(`
    Calculates skills of a player and sends a card picture.

    **Total value**
    \`osu!standard\`: 25% from Aim, 15% from Speed, 35% from Accuracy, 15% from Stamina, 20% from Reading.
    \`osu!taiko\`: 25% Rhythm, 20% Colour, 30% Stamina, 25% Reading.
    \`osu!catch\`: 45% Movement, 55% Accuracy.
    \`osu!mania\`: 30% Strain, 30% Speed, 40% Accuracy.

    **Rank**
    \`Total value < 3\`: Weak
    \`Total value < 5\`: Common
    \`Total value < 6.5\`: Average
    \`Total value < 8\`: Expert
    \`Total value < 9\`: Elite
    \`Total value < 10\`: Master
    \`Total value >= 10\`: Legend

    Some players might have special cards. They're either gurabot supporters or Hall of Famers.
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
