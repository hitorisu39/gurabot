import { Import, IsNumber, Option } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { OsuService } from "@/modules/osu/Osu.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { PopulatedUser } from "@domain/osu/Profile.dto";
import { PpTargetViewDataDto } from "@domain/osu/views/PpTarget.view";
import { AdapterProvider, GameMode } from "@generated/adapter/types";
import { CommandOption } from "@domain/core/Command";
import { scoreBestQueryLimit } from "@domain/osu/configs/Score.config";
import { PpTargetViewService } from "@/modules/osu/reach/PpTargetView.service";
import { PpTargetCalculator } from "@domain/osu/utils/PpTargetCalculator";
import { PpTargetCalculationDto, RankPpResolutionDto } from "@domain/osu/Reach.dto";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { ERankPpResolutionSource } from "@domain/osu/enums/Reach.enum";

export type TResolvedPpTarget = { type: "pp"; pp: number } | { type: "rank"; resolution: RankPpResolutionDto };

export abstract class AbstractPpTargetCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly ppTargetViewService: PpTargetViewService;

    @Option("plays", "Number of new plays used to reach the target")
    @IsNumber(1, 100)
    declare private readonly plays: CommandOption<number>;

    @Option("each", "PP value of each new play used to reach the target")
    @IsNumber(0, 99999)
    declare private readonly each: CommandOption<number>;

    public async execute(ctx: CommandContext): Promise<void> {
        this.validateOptions();

        const target = await this.resolveTarget(ctx);
        const { user, scores } = await this.osuService.userWithScores({
            nameOrID: target.query,
            mode: target.mode,
            type: "best",
            limit: scoreBestQueryLimit,
            provider: target.server,
        });

        if (!scores.length) {
            throw new Exception(EApplicationError.NOT_FOUND, "No top plays are available for the specified mode.");
        }

        const resolved = await this.resolvePpTarget(target.mode, target.server);
        const targetPP = resolved.type === "pp" ? resolved.pp : resolved.resolution.pp;

        if (user.statistics.pp >= targetPP)
            throw new Exception(EApplicationError.INPUT_ERROR, this.reachedMessage(user, resolved));

        const calculator = new PpTargetCalculator(scores, user.statistics.pp, scoreBestQueryLimit);
        const calculation = this.calculate(calculator, targetPP);

        const data: PpTargetViewDataDto = {
            profile: user,
            targetPP,
            rankResolution: resolved.type === "rank" ? resolved.resolution : undefined,
            calculation,
        };

        await ctx.respond(this.ppTargetViewService.build(data));
    }

    protected abstract resolvePpTarget(mode: GameMode, provider: AdapterProvider): Promise<TResolvedPpTarget>;

    private calculate(calculator: PpTargetCalculator, targetPP: number): PpTargetCalculationDto {
        if (this.plays.some()) {
            const plays = this.plays.unwrap();
            const result = calculator.calculateForPlays(targetPP, plays);

            if (!result) {
                throw new Exception(
                    EApplicationError.INPUT_ERROR,
                    `Reaching ${ProfileFormatter.pp(targetPP)} with ${plays} plays would require more than 99,999pp per play.`,
                );
            }

            return result;
        }

        if (this.each.some()) {
            const each = this.each.unwrap();
            const result = calculator.calculateForEach(targetPP, each);

            if (!result) {
                throw new Exception(
                    EApplicationError.INPUT_ERROR,
                    `Reaching ${ProfileFormatter.pp(targetPP)} with ${ProfileFormatter.pp(each)} plays is not possible within the top ${scoreBestQueryLimit} scores.`,
                );
            }

            return result;
        }

        const result = calculator.calculateAuto(targetPP);
        if (!result) {
            throw new Exception(
                EApplicationError.INPUT_ERROR,
                "The requested target is outside the supported simulation range.",
            );
        }

        return result;
    }

    private reachedMessage(user: PopulatedUser, resolvedTarget: TResolvedPpTarget): string {
        if (resolvedTarget.type === "pp") {
            return `${user.username} is already above ${ProfileFormatter.pp(resolvedTarget.pp)} with ${ProfileFormatter.pp(user.statistics.pp)}.`;
        }

        const resolution = resolvedTarget.resolution;
        const rank = ProfileFormatter.rank(resolution.rank, resolution.countryCode);

        if (resolution.source === ERankPpResolutionSource.Ranking && resolution.holder) {
            return (
                `Rank ${rank} is currently held by ${resolution.holder.username} with ${ProfileFormatter.pp(resolution.pp)}, ` +
                `so ${user.username} is already above that with ${ProfileFormatter.pp(user.statistics.pp)}.`
            );
        }

        return (
            `Rank ${rank} is currently approx. ${ProfileFormatter.pp(resolution.pp)}, ` +
            `so ${user.username} is already above that with ${ProfileFormatter.pp(user.statistics.pp)}.`
        );
    }

    private validateOptions(): void {
        if (this.plays.some() && this.each.some()) {
            throw new Exception(EApplicationError.INPUT_ERROR, 'Options "plays" and "each" cannot be used together.');
        }
    }
}
