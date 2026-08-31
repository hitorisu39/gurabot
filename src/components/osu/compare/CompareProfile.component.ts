import { Import, SelectMenu } from "@/core/decorators";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { Embed } from "@/core/discord/ui/Embed";
import { AbstractSessionComponent } from "@/components/AbstractSessionComponent";
import { CompareProfileViewService } from "@/modules/osu/compare/CompareProfileView.service";
import { OsuService } from "@/modules/osu/Osu.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { PopulatedScore, ScoreWithMaps } from "@domain/osu/Score.dto";
import { CompareProfileViewDto, ECompareProfileView } from "@domain/osu/views/CompareProfile.view";
import { GameMode } from "@generated/adapter/types";

@SelectMenu(/^osu_profile_compare:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class CompareProfileComponent extends AbstractSessionComponent<
    "osu_profile_compare_view",
    CompareProfileViewDto
> {
    @Import() declare private readonly compareProfileViewService: CompareProfileViewService;
    @Import() declare private readonly osuService: OsuService;

    protected readonly sessionKey = "osu_profile_compare_view";
    protected readonly dto = CompareProfileViewDto;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { sessionID } = ctx.params;
        if (!sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = await this.getData(ctx, sessionID);

        const view = ctx.values[0] as ECompareProfileView;
        if (!Object.values(ECompareProfileView).includes(view)) {
            throw new Exception(EApplicationError.INPUT_ERROR);
        }

        await ctx.deferUpdate();

        const requiresMaps = view === ECompareProfileView.Mapping || view === ECompareProfileView.Top100;
        const requiresCalculations = view === ECompareProfileView.Top100;

        let changed = false;

        if (requiresMaps && (!data.left.mapped || !data.right.mapped)) {
            await this.session.bump(this.sessionKey, sessionID);

            const result = await this.runWithLoading(
                ctx,
                async () => {
                    const combinedScores = [...data.left.scores, ...data.right.scores];
                    const mapped = await this.osuService.populateMaps(combinedScores, data.left.profile.provider);
                    const byScoreID = new Map(mapped.map((score) => [score.id, score]));

                    const leftMapped = data.left.scores
                        .map((score) => byScoreID.get(score.id))
                        .filter((score): score is ScoreWithMaps => score !== undefined);

                    const rightMapped = data.right.scores
                        .map((score) => byScoreID.get(score.id))
                        .filter((score): score is ScoreWithMaps => score !== undefined);

                    return {
                        leftMapped,
                        rightMapped,
                    };
                },
                {
                    embeds: [Embed.general("Downloading top-play beatmap data...")],
                    components: [],
                },
            );

            data.left.mapped = result.leftMapped;
            data.right.mapped = result.rightMapped;

            changed = true;
        }

        if (requiresCalculations && (!data.left.populated || !data.right.populated)) {
            if (!data.left.mapped || !data.right.mapped) {
                throw new Exception(
                    EApplicationError.INTERNAL_ERROR,
                    "Mapped scores were unavailable before top-play calculation.",
                );
            }

            await this.session.bump(this.sessionKey, sessionID);

            const result = await this.runWithLoading(
                ctx,
                async () => {
                    const [leftPopulated, rightPopulated] = await Promise.all([
                        data.left.mapped?.length
                            ? this.osuService.populateCalculations(data.left.mapped, data.left.profile.mode)
                            : Promise.resolve([]),
                        data.right.mapped?.length
                            ? this.osuService.populateCalculations(data.right.mapped, data.right.profile.mode)
                            : Promise.resolve([]),
                    ]);

                    return {
                        leftPopulated: leftPopulated as Array<PopulatedScore<GameMode>>,
                        rightPopulated: rightPopulated as Array<PopulatedScore<GameMode>>,
                    };
                },
                {
                    embeds: [Embed.general("Calculating top-play statistics... This may take up to 60 seconds.")],
                    components: [],
                },
            );

            data.left.populated = result.leftPopulated;
            data.right.populated = result.rightPopulated;

            changed = true;
        }

        if (changed) {
            await this.session.update(
                this.sessionKey,
                sessionID,
                {
                    left: data.left,
                    right: data.right,
                },
                this.compareProfileViewService.getTtl(),
            );
        }

        await ctx.update(this.compareProfileViewService.build(sessionID, data, view));
    }
}
