import { AbstractSessionCommand } from "@/commands/AbstractSessionCommand";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { Category, Command, Examples, Help, Import, Inject, IsString, Option } from "@/core/decorators";
import { OsuService } from "@/modules/osu/Osu.service";
import { ScoreResolverService } from "@/modules/osu/ScoreResolver.service";
import { FixViewService } from "@/modules/osu/fix/FixView.service";
import { CommandOption, ECommandCategory } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { scoreBestQueryLimit } from "@domain/osu/configs/Score.config";
import { FixViewDto } from "@domain/osu/views/Fix.view";
import { AdapterProvider } from "@generated/adapter/types";

@Help(`
    Shows how a score could look after fixing its misses and combo breaks.

    By default, the score is converted to a full combo while preserving a
    calculator-proposed accuracy. Use the buttons to change accuracy, combo,
    misses, or exact hit counts and see the resulting score pp, profile pp,
    and approximate global rank.

    A score URL or ID can be provided directly. Otherwise, the latest score
    shown in the channel is used. You can also reply to a score message.
`)
@Examples("fix", "fix https://osu.ppy.sh/scores/1234567890", "fix 1234567890")
@Category(ECommandCategory.Osu)
@Command({
    name: "fix",
    description: "Shows how a score could look with adjusted misses and accuracy.",
    aliases: ["fixscore"],
})
export class FixCommand extends AbstractSessionCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly scoreResolverService: ScoreResolverService;
    @Import() declare private readonly fixViewService: FixViewService;

    @Option("score", "Specify an osu! score URL or ID")
    @IsString()
    @Inject()
    declare private readonly score: CommandOption<string>;

    public async execute(ctx: CommandContext): Promise<void> {
        const provider = AdapterProvider.Bancho;
        const scoreID = await this.scoreResolverService.resolveCommandTarget(ctx, this.score);
        const score = await this.osuService.score(scoreID, provider);

        if (!score.passed) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Failed scores cannot be fixed yet.");
        }

        const beatmap = score.beatmap ?? (await this.osuService.beatmap(score.beatmapID, provider));
        if (!beatmap) {
            throw new Exception(EApplicationError.NOT_FOUND, "The score's beatmap could not be found.");
        }

        const mode = score.mode ?? beatmap.mode;
        const [profile, topScores, populatedScores] = await Promise.all([
            this.osuService.user(score.userID, mode, provider),
            this.osuService.best(score.userID, mode, scoreBestQueryLimit, provider),
            this.osuService.populateAll([score], mode, true, provider),
        ]);

        const populated = populatedScores[0];
        if (!populated?.calculatedFC) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "Could not calculate a fixed version of this score.");
        }

        /**
         * Already-FC scores with stored PP reuse their existing calculation,
         * which intentionally has no generated hit results.
         */
        const proposedAccuracy = populated.calculatedFC.hitResults?.accuracy ?? populated.accuracy;

        const data: FixViewDto = {
            timestamp: Date.now(),
            authorID: ctx.author.id,
            profile,
            sourceScore: populated,
            topScores,
            proposedAccuracy,
            accuracy: proposedAccuracy,
            statistics: {
                countMiss: 0,
            },
        };

        await this.respondWithSession(ctx, "osu_fix_view", data, this.fixViewService);
    }
}
