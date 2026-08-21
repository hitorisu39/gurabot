import { Category, Examples, Help, Import, IsModsArray, Option, Required } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { Embed } from "@/core/discord/ui/Embed";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { OsuService } from "@/modules/osu/Osu.service";
import { TopIfViewService } from "@/modules/osu/topif/TopIfView.service";
import { CommandOption, ECommandCategory, ICommandMods } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ScoreWithMaps } from "@domain/osu/Score.dto";
import { TopIfProjectionDto, TopIfScore } from "@domain/osu/TopIf.dto";
import { TopIfViewDto } from "@domain/osu/views/TopIf.view";
import { ScoreGradeEvaluator } from "@domain/osu/utils/ScoreGradeEvaluator";
import { ScoreUtils } from "@domain/osu/utils/ScoreUtils";
import { ModTransformer } from "@domain/osu/utils/ModTransformer";
import { scoreBestQueryLimit } from "@domain/osu/configs/Score.config";
import { plainToInstance } from "class-transformer";

@Help(`
    Shows hypothetical top plays after changing the mods on every score.
    Mod operations are applied from left to right.

    \`+HD\`: Adds Hidden to every score. Incompatible existing mods are replaced.
    \`-DT!\`: Removes Double Time from every score.
    \`+DT!\`: Replaces the entire mod combination of every score with Double Time.

    Multiple operations can be combined: \`+HD -HR!\`
    Scores are sorted by their hypothetical pp after applying the changes.
`)
@Examples("topif mrekk +dt", "topif mrekk +hd -hr!", "topif mrekk +dt! +hd")
@Category(ECommandCategory.Osu)
export abstract class AbstractTopIfCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly topIfViewService: TopIfViewService;

    @Option("mods", "Modify mods on every top score")
    @IsModsArray()
    @Required()
    declare private readonly mods: CommandOption<Array<ICommandMods>>;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const operations = this.mods.unwrap();

        const { user, scores } = await this.osuService.userWithScores({
            nameOrID: target.query,
            mode: target.mode,
            type: "best",
            limit: scoreBestQueryLimit,
            provider: target.server,
        });

        if (!scores.length) {
            await ctx.respond(Embed.error(`No top plays were found for **${user.username}**.`));
            return;
        }

        const scoresWithMaps = await this.osuService.populateMaps(scores, target.server);

        const sources = scores.map((score, index) => {
            const populated = scoresWithMaps.find((candidate) => ScoreUtils.compare(score, candidate));

            if (!populated) {
                throw new Exception(
                    EApplicationError.INTERNAL_ERROR,
                    `Could not populate the beatmap for top score #${index + 1}.`,
                );
            }

            return {
                originalIndex: index + 1,
                score: populated,
            };
        });

        const missingOriginalPP = sources
            .filter(({ score }) => ScoreUtils.pp(score) === undefined)
            .map(({ score }) => score);

        const populatedMissingOriginal = missingOriginalPP.length
            ? await this.osuService.populateCalculations(missingOriginalPP, target.mode, false)
            : [];

        const entries = sources.map(({ originalIndex, score }) => {
            const populatedOriginal =
                populatedMissingOriginal.find((candidate) => ScoreUtils.compare(score, candidate)) ?? score;

            const originalPP = ScoreUtils.pp(populatedOriginal);

            if (originalPP === undefined) {
                throw new Exception(
                    EApplicationError.INTERNAL_ERROR,
                    `Could not determine the original pp for top score #${originalIndex}.`,
                );
            }

            const projectedMods = ModTransformer.apply(score.mods, operations);
            const hypothetical = plainToInstance(ScoreWithMaps, {
                ...score,
                pp: undefined,
                mods: projectedMods,
            });
            return {
                originalIndex,
                originalPP,
                originalMods: [...score.mods],
                hypothetical,
            };
        });

        const calculated = await this.osuService.populateCalculations(
            entries.map((entry) => entry.hypothetical),
            target.mode,
            false,
        );

        const projectedScores = calculated.map((score, index) => {
            const source = entries[index];
            if (!source) {
                throw new Exception(
                    EApplicationError.INTERNAL_ERROR,
                    `Missing top-if source score for index ${index}.`,
                );
            }

            const hitResults = score.calculated.hitResults;
            if (!hitResults) {
                throw new Exception(
                    EApplicationError.INTERNAL_ERROR,
                    `The calculator did not return hit results for top score #${source.originalIndex}.`,
                );
            }

            const projectedPP = score.calculated.attributes.total;
            const projection = plainToInstance(TopIfProjectionDto, {
                originalIndex: source.originalIndex,
                projectedIndex: source.originalIndex,
                originalPP: source.originalPP,
                originalMods: source.originalMods,
            });

            return plainToInstance(TopIfScore, {
                ...score,
                pp: projectedPP,
                grade: ScoreGradeEvaluator.evaluate(target.mode, hitResults, score.mods),
                topIf: projection,
            });
        });

        projectedScores.sort((a, b) => {
            const ppDifference = b.calculated.attributes.total - a.calculated.attributes.total;

            if (ppDifference !== 0) {
                return ppDifference;
            }

            return a.topIf.originalIndex - b.topIf.originalIndex;
        });

        for (const [index, score] of projectedScores.entries()) {
            score.topIf.projectedIndex = index + 1;
        }

        const currentWeightedPP = ScoreUtils.weightedPPValues(entries.map((entry) => entry.originalPP));

        const projectedWeightedPP = ScoreUtils.weightedPPValues(
            projectedScores.map((score) => score.calculated.attributes.total),
        );

        const originalTotalPP = user.statistics.pp;
        const projectedTotalPP = Math.max(0, originalTotalPP - currentWeightedPP + projectedWeightedPP);

        const data: TopIfViewDto = {
            timestamp: Date.now(),
            authorID: ctx.author.id,
            profile: user,
            scores: projectedScores,
            operations,
            originalTotalPP,
            projectedTotalPP,
            page: 1,
        };

        await this.topIfViewService.prepare(data);
        await this.respondWithSession(ctx, "osu_topif_view", data, this.topIfViewService);
    }
}
