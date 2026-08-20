import { Category, Examples, Help, Import } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";

import { OsuService } from "@/modules/osu/Osu.service";
import { OsuStatsService } from "@/modules/osustats/OsuStats.service";

import { AdapterProvider } from "@generated/adapter/types";
import { OsuStatsCountViewDto } from "@domain/osustats/views/OsuStatsCount.view";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { OsuStatsCountViewService } from "@/modules/osustats/OsuStatsCountView.service";
import { ECommandCategory } from "@domain/core/Command";

@Help(`
    Shows how often the specified player appears on {mode} map global leaderboards.
    Counts are cumulative across Top 1, Top 8, Top 15, Top 25, Top 50, and Top 100.
`)
@Examples("osustatscount", "osc mrekk", 'osc "spaced name"')
@Category(ECommandCategory.Osu)
export class AbstractOsuStatsCountCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly osuStatsService: OsuStatsService;
    @Import() declare private readonly osuStatsCountViewService: OsuStatsCountViewService;

    protected forcedServer = AdapterProvider.Bancho;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const profile = await this.osuService.user(target.query, target.mode, AdapterProvider.Bancho);

        const counts = await this.osuStatsService.counts(profile.username, target.mode);

        const data: OsuStatsCountViewDto = {
            profile,
            counts,
        };

        await ctx.respond(this.osuStatsCountViewService.build(data));
    }
}
