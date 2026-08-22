import { Category, Examples, Help, Import, InjectToken, IsString, Option, Required } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { OsuService } from "@/modules/osu/Osu.service";
import { CommandOption, ECommandCategory } from "@domain/core/Command";
import { scoreBestQueryLimit } from "@domain/osu/configs/Score.config";
import { Score } from "@generated/adapter/types";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { CommonTopComparisonDto, CompareTopViewDto } from "@domain/osu/views/CompareTop.view";
import { CompareTopViewService } from "@/modules/osu/compare/CompareTopView.service";

@Help(`
    Shows maps shared between two players' top {mode} scores and compares their pp on each map.
    Common plays are matched by beatmap ID and ordered by the stronger pp value on each map.
`)
@Examples("common mrekk", "common mrekk WhiteCat", 'common mrekk "spaced name"')
@Category(ECommandCategory.Osu)
export abstract class AbstractCompareTopCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly compareTopViewService: CompareTopViewService;

    @Option("opponent", "Player to compare top plays against")
    @IsString()
    @InjectToken()
    @Required()
    declare private readonly opponent: CommandOption<string>;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const opponentQuery = await this.resolveExplicitTarget(this.opponent.unwrap(), target.server);

        const [leftResult, rightResult] = await Promise.all([
            this.osuService.userWithScores({
                nameOrID: target.query,
                mode: target.mode,
                type: "best",
                limit: scoreBestQueryLimit,
                provider: target.server,
            }),

            this.osuService.userWithScores({
                nameOrID: opponentQuery,
                mode: target.mode,
                type: "best",
                limit: scoreBestQueryLimit,
                provider: target.server,
            }),
        ]);

        const leftByMap = this.bestByBeatmap(leftResult.scores);
        const rightByMap = this.bestByBeatmap(rightResult.scores);

        const common = Array.from(leftByMap.entries())
            .filter(([beatmapID]) => rightByMap.has(beatmapID))
            .map(([beatmapID, leftScore]) => {
                const rightScore = rightByMap.get(beatmapID)!;

                return {
                    beatmapID,
                    leftPP: leftScore.pp ?? 0,
                    rightPP: rightScore.pp ?? 0,
                    representative: leftScore,
                };
            })
            .sort((a, b) => {
                const strongestDiff = Math.max(b.leftPP, b.rightPP) - Math.max(a.leftPP, a.rightPP);
                if (strongestDiff !== 0) {
                    return strongestDiff;
                }

                const combinedDiff = b.leftPP + b.rightPP - (a.leftPP + a.rightPP);
                if (combinedDiff !== 0) {
                    return combinedDiff;
                }

                return a.beatmapID - b.beatmapID;
            });

        const mapped = common.length
            ? await this.osuService.populateMaps(
                  common.map((entry) => entry.representative),
                  target.server,
              )
            : [];

        const mapsByID = new Map(mapped.map((score) => [score.beatmapID, score.beatmap]));

        const comparisons: Array<CommonTopComparisonDto> = common
            .map((entry) => {
                const beatmap = mapsByID.get(entry.beatmapID);

                if (!beatmap?.beatmapset) {
                    return null;
                }

                return {
                    beatmapID: entry.beatmapID,
                    leftPP: entry.leftPP,
                    rightPP: entry.rightPP,
                    beatmap,
                };
            })
            .filter((entry): entry is CommonTopComparisonDto => entry !== null);

        const data: CompareTopViewDto = {
            timestamp: Date.now(),
            authorID: ctx.author.id,
            left: leftResult.user,
            right: rightResult.user,
            comparisons,
            page: 1,
        };

        await this.respondWithSession(ctx, "osu_compare_top_view", data, this.compareTopViewService);
    }

    private bestByBeatmap(scores: ReadonlyArray<Score>): Map<number, Score> {
        const result = new Map<number, Score>();

        for (const score of scores) {
            const existing = result.get(score.beatmapID);

            if (!existing || (score.pp ?? 0) > (existing.pp ?? 0)) {
                result.set(score.beatmapID, score);
            }
        }

        return result;
    }
}
