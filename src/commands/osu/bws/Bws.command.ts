import { Category, Command, Examples, Help, Import, InjectMatch, IsNumber, Option } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { OsuService } from "@/modules/osu/Osu.service";
import { BwsViewService } from "@/modules/osu/bws/BwsView.service";
import { CommandMatcher, CommandOption, ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";
import { BadgeEvaluator } from "@domain/osu/utils/BadgeEvaluator";
import { BadgeWeightedRankCalculator } from "@domain/osu/utils/BadgeWeightedRankCalculator";
import { TextFormatter } from "@domain/discord/formatters/Text.formatter";

@Help(`
    Badge-weighted seeding (BWS) adjusts a player's global rank based on the number of tournament badges they have earned.
    It is commonly used for tournament seeding and eligibility.

    See https://osu.ppy.sh/wiki/en/Tournaments/Badge-weighted_seeding for more information.
`)
@Examples("bws Bubbleman", "bws mrekk 1")
@Category(ECommandCategory.Osu)
@Command({
    name: "bws",
    description: "Shows badge-weighted seeding for an osu! player.",
})
export class BwsCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly bwsViewService: BwsViewService;

    @Option("badges", "Override the player's detected tournament badge count.")
    @InjectMatch(CommandMatcher.positiveInteger)
    @IsNumber()
    declare private readonly badges: CommandOption<number>;

    protected forcedMode = GameMode.Standard;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const profile = await this.osuService.user(target.query, target.mode, target.server);

        const rank = profile.statistics.globalRank;
        const detectedBadgeCount = BadgeEvaluator.tournament(profile.badges ?? [], target.mode).length;
        const badgeCount = this.badges.unwrapOr(detectedBadgeCount);

        const bws = BadgeWeightedRankCalculator.calculate(rank, badgeCount);
        const nextBws = BadgeWeightedRankCalculator.calculate(rank, badgeCount + 1);

        const content = this.badges.some()
            ? `${TextFormatter.possessive(profile.username, true)} BWS with ${badgeCount} badges:`
            : undefined;

        const embed = this.bwsViewService.build({
            profile,
            badgeCount,
            bws,
            nextBws,
            custom: this.badges.some(),
        });

        await ctx.respond({
            content,
            embeds: [embed],
        });
    }
}
