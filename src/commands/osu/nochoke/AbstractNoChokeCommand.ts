import { Aliases, Examples, Help, Import, IsInteger, Option } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { Embed } from "@/core/discord/ui/Embed";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { OsuService } from "@/modules/osu/Osu.service";
import { NoChokeViewService } from "@/modules/osu/nochoke/NoChokeView.service";
import { CommandOption } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { NoChokeProjectionDto, NoChokeScore } from "@domain/osu/NoChoke.dto";
import { PopulatedScore } from "@domain/osu/Score.dto";
import { ScoreGradeEvaluator } from "@domain/osu/utils/ScoreGradeEvaluator";
import { ScoreUtils } from "@domain/osu/utils/ScoreUtils";
import { NoChokeViewDto } from "@domain/osu/views/NoChoke.view";
import { GameMode, Score } from "@generated/adapter/types";
import { plainToInstance } from "class-transformer";

@Help(`
    Shows projected top plays after removing misses and recalculating full-combo PP.

    All top scores are displayed. Scores that are not eligible for no-choke
    calculation remain unchanged.

    By default, every score containing misses is unchoked.

    Use \`miss=<number>\` to restrict which scores are unchoked.
    For example, \`miss=2\` only unchokes scores containing two or fewer misses.
`)
@Examples("nochoke", "nochoke mrekk", "nochoke mrekk miss=2", "nochoke miss=1")
export abstract class AbstractNoChokeCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly noChokeViewService: NoChokeViewService;

    @Option("miss", "Only unchoke scores with this many misses or fewer. Omit for unlimited.")
    @IsInteger(0, 99_999)
    @Aliases("misses")
    declare private readonly miss: CommandOption<number>;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const maximumMisses = this.miss.unwrapUnchecked();

        const { user, scores } = await this.osuService.userWithScores({
            nameOrID: target.query,
            mode: target.mode,
            type: "best",
            limit: 100,
            provider: target.server,
        });

        if (!scores.length) {
            await ctx.respond(Embed.error(`No top plays were found for **${user.username}**.`));
            return;
        }

        const eligibleScores = scores.filter((score) => this.shouldUnchoke(score, maximumMisses));
        const missingCurrentPP = scores.filter(
            (score) => !this.shouldUnchoke(score, maximumMisses) && ScoreUtils.pp(score) === undefined,
        );

        const [populatedEligible, populatedCurrent] = await Promise.all([
            eligibleScores.length
                ? this.osuService.populateAll(eligibleScores, target.mode, true, target.server)
                : Promise.resolve<Array<PopulatedScore>>([]),

            missingCurrentPP.length
                ? this.osuService.populateAll(missingCurrentPP, target.mode, false, target.server)
                : Promise.resolve<Array<PopulatedScore>>([]),
        ]);

        const populatedPool: Array<PopulatedScore> = [...populatedEligible, ...populatedCurrent];

        const projectedScores = scores.map((originalScore, index) => {
            const populatedScore =
                populatedPool.find((candidate) => ScoreUtils.compare(originalScore, candidate)) ?? originalScore;

            const originalIndex = index + 1;

            if (this.shouldUnchoke(originalScore, maximumMisses)) {
                if (!ScoreUtils.isFullyPopulated(populatedScore)) {
                    throw new Exception(
                        EApplicationError.INTERNAL_ERROR,
                        `Could not calculate the no-choke result for score #${originalIndex}.`,
                    );
                }

                return this.createProjectedScore(populatedScore, target.mode, originalIndex);
            }

            return this.createUnchangedScore(populatedScore, originalIndex);
        });

        projectedScores.sort((a, b) => {
            const ppDifference = b.noChoke.projectedPP - a.noChoke.projectedPP;

            if (ppDifference !== 0) {
                return ppDifference;
            }

            return a.noChoke.originalIndex - b.noChoke.originalIndex;
        });

        for (const [index, score] of projectedScores.entries()) {
            score.noChoke.projectedIndex = index + 1;
        }

        const currentWeightedPP = ScoreUtils.weightedPPValues(projectedScores.map((score) => score.noChoke.originalPP));

        const projectedWeightedPP = ScoreUtils.weightedPPValues(
            projectedScores.map((score) => score.noChoke.projectedPP),
        );

        const originalTotalPP = user.statistics.pp;
        const projectedTotalPP = Math.max(0, originalTotalPP - currentWeightedPP + projectedWeightedPP);

        const data: NoChokeViewDto = {
            timestamp: Date.now(),
            authorID: ctx.author.id,
            profile: user,
            scores: projectedScores,
            originalTotalPP,
            projectedTotalPP,
            maximumMisses,
            page: 1,
        };

        await this.noChokeViewService.prepare(data);
        await this.respondWithSession(ctx, "osu_nochoke_view", data, this.noChokeViewService);
    }

    private createProjectedScore(score: PopulatedScore, mode: GameMode, originalIndex: number): NoChokeScore {
        const calculatedFC = score.calculatedFC;

        if (!calculatedFC?.hitResults) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                `The calculator did not return a full-combo result for score #${originalIndex}.`,
            );
        }

        const originalPP = ScoreUtils.pp(score);
        const removedMisses = score.statistics.miss;

        const projection = plainToInstance(NoChokeProjectionDto, {
            applied: true,

            originalIndex,
            projectedIndex: originalIndex,

            originalMisses: removedMisses,
            removedMisses,

            originalPP,
            projectedPP: calculatedFC.attributes.total,

            originalAccuracy: score.accuracy,
            projectedAccuracy: calculatedFC.hitResults.accuracy,

            originalCombo: score.maxCombo,
            projectedCombo: calculatedFC.difficulty.attributes.maxCombo,

            originalGrade: score.grade,
            projectedGrade: ScoreGradeEvaluator.evaluate(mode, calculatedFC.hitResults, score.mods),
        });

        return plainToInstance(NoChokeScore, {
            ...score,
            noChoke: projection,
        });
    }

    private createUnchangedScore(score: Score, originalIndex: number): NoChokeScore {
        const originalPP = ScoreUtils.pp(score);
        const originalMisses = score.statistics.miss;

        const projection = plainToInstance(NoChokeProjectionDto, {
            applied: false,

            originalIndex,
            projectedIndex: originalIndex,

            originalMisses,
            removedMisses: 0,

            originalPP,
            projectedPP: originalPP,

            originalAccuracy: score.accuracy,
            projectedAccuracy: score.accuracy,

            originalCombo: score.maxCombo,
            projectedCombo: score.maxCombo,

            originalGrade: score.grade,
            projectedGrade: score.grade,
        });

        return plainToInstance(NoChokeScore, {
            ...score,
            noChoke: projection,
        });
    }

    private shouldUnchoke(score: Score, maximumMisses: number | null): boolean {
        if (ScoreUtils.isFC(score)) return false;
        return maximumMisses === null || score.statistics.miss <= maximumMisses;
    }
}
