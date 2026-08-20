import { Category, Examples, Help, Import, InjectToken, IsString, Option, Required } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { OsuService } from "@/modules/osu/Osu.service";
import { OsuStatsService } from "@/modules/osustats/OsuStats.service";
import { OsuStatsCompareViewService } from "@/modules/osustats/OsuStatsCompareView.service";
import { CommandOption, ECommandCategory } from "@domain/core/Command";
import { AdapterProvider } from "@generated/adapter/types";
import { OsuStatsCompareViewDto } from "@domain/osustats/views/OsuStatsCompare.view";
import { AbstractOsuCommand } from "../AbstractOsuCommand";

@Help(`
    Compares how often two players appear on {mode} map global leaderboards.
    The comparison includes cumulative Top 1, Top 8, Top 15, Top 25, Top 50, and Top 100 counts.

    The first username specifies the player being compared.
    An optional second username specifies the other player. If omitted, your linked/default player is used.

    Delta is calculated as the first player's count minus the second player's count.
`)
@Examples("osustatscompare mrekk", "oscmp mrekk lifeline", 'osgap "spaced name" mrekk')
@Category(ECommandCategory.Osu)
export class AbstractOsuStatsCompareCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly osuStatsService: OsuStatsService;
    @Import() declare private readonly osuStatsCompareViewService: OsuStatsCompareViewService;

    @Option("target", "Player to compare against")
    @IsString()
    @InjectToken()
    @Required()
    declare private readonly compareTarget: CommandOption<string>;

    protected forcedServer = AdapterProvider.Bancho;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);

        const [leftProfile, rightProfile] = await Promise.all([
            this.osuService.user(target.query, target.mode, AdapterProvider.Bancho),
            this.osuService.user(this.compareTarget.unwrap(), target.mode, AdapterProvider.Bancho),
        ]);

        const [leftCounts, rightCounts] = await Promise.all([
            this.osuStatsService.counts(leftProfile.username, target.mode),
            this.osuStatsService.counts(rightProfile.username, target.mode),
        ]);

        const data: OsuStatsCompareViewDto = {
            leftProfile,
            rightProfile,
            leftCounts,
            rightCounts,
        };

        await ctx.respond(this.osuStatsCompareViewService.build(data));
    }
}
