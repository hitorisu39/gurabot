import { Aliases, Examples, Help, Import, Inject, IsNumber, Option } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { OsuService } from "@/modules/osu/Osu.service";
import { OsuDailyService } from "@/modules/osudaily/OsuDaily.service";
import { WhatIfViewService } from "@/modules/osu/whatif/WhatIfView.service";
import { CommandOption } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ScoreUtils } from "@domain/osu/utils/ScoreUtils";
import { AdapterProvider } from "@generated/adapter/types";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { WhatIfViewDataDto } from "@domain/osu/views/WhatIf.view";

@Help(`
    Calculates how a new performance play would affect a player's total pp.
    Global rank changes are approximate and are only available on Bancho.
`)
@Examples("whatif 500", "whatif 500 WhiteCat", "mwi 750 drusserf")
export abstract class AbstractWhatIfCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly osuDailyService: OsuDailyService;
    @Import() declare private readonly whatIfViewService: WhatIfViewService;

    @Option("pp", "Amount of PP for the hypothetical performance play")
    @IsNumber(0, 999999)
    @Inject()
    @Aliases("value")
    declare private readonly pp: CommandOption<number>;

    public async execute(ctx: CommandContext): Promise<void> {
        const playPP = this.resolvePP();
        const target = await this.resolveTarget(ctx);

        const { user, scores } = await this.osuService.userWithScores({
            nameOrID: target.query,
            mode: target.mode,
            type: "best",
            limit: 100,
            provider: target.server,
        });

        if (!scores.length) {
            throw new Exception(EApplicationError.NOT_FOUND, "No top plays are available for the specified mode.");
        }

        const projection = ScoreUtils.projectPP(scores, playPP, 100);

        if (projection.placement === null) {
            throw new Exception(
                EApplicationError.INPUT_ERROR,
                `A ${DiscordFormatter.fixed(playPP)}pp play would not enter ${user.username}'s top plays.`,
            );
        }

        const currentPP = user.statistics.pp;
        const projectedPP = currentPP + projection.weightedDifference;
        let projectedRank: number | undefined;

        if (target.server === AdapterProvider.Bancho) {
            projectedRank = await this.osuDailyService
                .rankByPP(projectedPP, target.mode, target.server)
                .catch(() => undefined);
        }

        const data: WhatIfViewDataDto = {
            timestamp: Date.now(),
            profile: user,

            playPP,
            placement: projection.placement,

            currentPP,
            projectedPP,
            ppDifference: projectedPP - currentPP,

            currentRank: user.statistics.globalRank,
            projectedRank,
        };

        await ctx.respond(this.whatIfViewService.build(data));
    }

    private resolvePP(): number {
        if (!this.pp.some()) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Provide pp as a positive number.");
        }

        return this.pp.unwrap();
    }
}
