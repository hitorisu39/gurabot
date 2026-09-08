import { Import, Inject, IsString, Option, Required, Subcommand } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { CommandOption } from "@domain/core/Command";
import { AbstractOsuCommand } from "@/commands/osu/AbstractOsuCommand";
import { OsuService } from "@/modules/osu/Osu.service";
import { OtrService } from "@/modules/otr/api/Otr.service";
import { OtrCompareViewService } from "@/modules/otr/views/OtrCompareView.service";
import { AdapterProvider } from "@generated/adapter/types";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { EOtrCompareView, OtrCompareViewDto } from "@domain/otr/views/OtrCompare.view";

@Subcommand({
    root: "otr",
    name: "compare",
    description: "Compares the tournament ratings of two osu! players.",
})
export class OtrCompareSubcommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly otrService: OtrService;
    @Import() declare private readonly compareViewService: OtrCompareViewService;

    @Option("opponent", "Specify the player to compare against")
    @IsString()
    @Inject()
    @Required()
    declare private readonly opponent: CommandOption<string>;

    protected forcedServer = AdapterProvider.Bancho;

    public async execute(ctx: CommandContext): Promise<void> {
        if (!this.opponent.some()) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Please specify an opponent.");
        }

        const target = await this.resolveTarget(ctx);
        const opponent = await this.resolveExplicitTarget(this.opponent.unwrap(), AdapterProvider.Bancho);

        const [leftProfile, rightProfile] = await Promise.all([
            this.osuService.user(target.query, target.mode, AdapterProvider.Bancho),
            this.osuService.user(opponent, target.mode, AdapterProvider.Bancho),
        ]);

        if (leftProfile.id === rightProfile.id) {
            throw new Exception(EApplicationError.INPUT_ERROR, "You can't compare a player with themselves.");
        }

        const [leftStats, rightStats] = await Promise.all([
            this.otrService.playerStats(leftProfile.id, { mode: leftProfile.mode }),
            this.otrService.playerStats(rightProfile.id, { mode: rightProfile.mode }),
        ]);

        const data: OtrCompareViewDto = {
            authorID: ctx.author.id,
            leftProfile,
            rightProfile,
            leftStats,
            rightStats,
        };

        await this.respondWithSession(ctx, "otr_compare_view", data, this.compareViewService, EOtrCompareView.Overview);
    }
}
