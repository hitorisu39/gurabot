import { Category, Examples, Help, Import } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractOsuCommand } from "@/commands/osu/AbstractOsuCommand";
import { ECommandCategory } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ProviderMeta } from "@generated/adapter";
import { AttachmentBuilder } from "discord.js";
import { OsuService } from "@/modules/osu/Osu.service";
import { SkillCalculatorService } from "@/modules/osu/skills/SkillCalculator.service";
import { GraphSkillsCurveService } from "@/modules/osu/graph/GraphSkillsCurve.service";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { scoreFetchBestLimit } from "@domain/osu/configs/Score.config";

@Help(`
    Graphs the distribution of calculated skill values across a player's top 100 plays.
    Each skill is sorted independently from strongest to weakest.
`)
@Examples("gsc", "gsc mrekk")
@Category(ECommandCategory.Osu)
export abstract class AbstractGraphSkillsCurveCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly skillCalculatorService: SkillCalculatorService;
    @Import() declare private readonly graphSkillsCurveService: GraphSkillsCurveService;
    @Import() declare private readonly profileViewService: ProfileViewService;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);

        const timestamp = Date.now();

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

        const result = this.skillCalculatorService.calculateDistribution(target.mode, populated);
        const categories = result.categories.filter((category) => category.values.length > 0);

        if (!categories.length) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "No valid skill values could be calculated from this player's top plays.",
            );
        }

        const image = await this.graphSkillsCurveService.generate(categories);
        const filename = `skill-curves-${user.id}.png`;
        const embed = this.profileViewService.createBaseEmbed(user, timestamp, false);

        embed.setThumbnail(null).setTitle("Skill curves").setImage(`attachment://${filename}`);

        await ctx.respond({
            embeds: [embed],

            files: [
                new AttachmentBuilder(image, {
                    name: filename,
                }),
            ],
        });
    }
}
