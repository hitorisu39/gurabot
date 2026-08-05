import { Command, Examples, Import } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { OsuService } from "@/modules/osu/Osu.service";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { FarmerEvaluator, IFarmerAnalysis } from "@domain/osu/utils/FarmerEvaluator";
import { GameMode } from "@generated/adapter/types";
import { Embed } from "@/core/discord/ui/Embed";

@Examples("amifarmer", "amifarmer mrekk", "aif whitecat")
@Command({
    name: "amifarmer",
    description: "Tells you whether an osu!standard player is a dirty farmer.",
    aliases: ["aif", "amiafarmer", "aiaf"],
})
export class AmIFarmerCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly profileViewService: ProfileViewService;

    private readonly evaluator = new FarmerEvaluator();

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        if (target.mode !== GameMode.Standard) {
            await ctx.respond(Embed.error("This command is only available for osu!standard."));
            return;
        }

        const timestamp = Date.now();
        const { user, scores } = await this.osuService.userWithScores({
            nameOrID: target.query,
            mode: target.mode,
            type: "best",
            limit: 100,
            provider: target.server,
        });

        const scoresWithMaps = await this.osuService.populateMaps(scores, target.server);
        const analysis = this.evaluator.evaluate(scoresWithMaps);

        const embed = this.profileViewService
            .createBaseEmbed(user, timestamp, false)
            .setTitle(`Is ${user.username} a farmer?`)
            .setDescription(this.buildDescription(analysis));

        await ctx.respond(embed);
    }

    private buildDescription(analysis: IFarmerAnalysis): string {
        if (analysis.totalCount === 0) {
            return [
                "I found `0` farm maps in your top plays!",
                "",
                "Congratulations, you are actually a good player!",
            ].join("\n");
        }

        const mapperBreakdown = analysis.mapperCounts
            .map(({ mapper, count }) => {
                const noun = count === 1 ? "map" : "maps";
                return `\`${count} ${noun} by ${mapper.name}\``;
            })
            .join(", ");

        const mapNoun = analysis.totalCount === 1 ? "map" : "maps";

        return [
            `I found \`${analysis.totalCount}\` farm ${mapNoun} in your top plays:`,
            mapperBreakdown,
            "",
            `Congratulations! Your farmer rank is \`${analysis.rank.name}\`.`,
            analysis.rank.message,
        ].join("\n");
    }
}
