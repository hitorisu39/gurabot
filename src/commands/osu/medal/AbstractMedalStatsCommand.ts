import { Import } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { OsuService } from "@/modules/osu/Osu.service";
import { MedalStatsViewService } from "@/modules/osu/medal/MedalStatsView.service";
import { MedalStatsViewDto } from "@domain/osu/views/MedalStats.view";
import { AdapterProvider } from "@generated/adapter/types";
import { OsekaiService } from "@/modules/osekai/Osekai.service";

export abstract class AbstractMedalStatsCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly osekaiService: OsekaiService;
    @Import() declare private readonly medalStatsViewService: MedalStatsViewService;

    protected forcedServer = AdapterProvider.Bancho;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const [profile, medals] = await Promise.all([
            this.osuService.user(target.query, target.mode, target.server),
            this.osekaiService.medals(),
        ]);

        const data: MedalStatsViewDto = {
            profile,
            medals,
        };

        await ctx.respond(await this.medalStatsViewService.build(data));
    }
}
