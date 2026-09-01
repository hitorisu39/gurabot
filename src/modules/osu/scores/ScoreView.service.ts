import { Import } from "@/core/decorators";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { Pagination } from "@domain/discord/utils/Pagination";
import { ScoresViewDto } from "@domain/osu/views/Scores.view";
import { AdapterProvider, GameMode, Score } from "@generated/adapter/types";
import { OsuService } from "../Osu.service";
import { EScoreListSize, EScoreViewLayout } from "@domain/osu/enums/Score.enum";
import { AbstractScoreView } from "./AbstractScoreView";
import { ListScoreView } from "./ListScoreView.service";
import { CompareScoreView } from "./CompareScoreView.service";
import { ScoreUtils } from "@domain/osu/utils/ScoreUtils";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { Embed } from "@/core/discord/ui/Embed";
import { ActionRow } from "@/core/discord/ui/ActionRow";
import { ButtonStyle, InteractionResponse, Message } from "discord.js";

interface IScoreViewPopulateContext {
    personalScores?: Array<Score> | Promise<Array<Score>>;
    globalScores?: Array<Score> | Promise<Array<Score>>;
}

export class ScoreViewService extends AbstractViewService<ScoresViewDto, Record<string, unknown>> {
    @Import() declare private readonly osuService: OsuService;

    // Views services
    @Import() declare private readonly listScoreView: ListScoreView;
    @Import() declare private readonly compareScoreView: CompareScoreView;

    protected readonly ttl: number = 180;
    protected readonly actionButtonsTtl = 30;

    private views: Map<EScoreViewLayout, AbstractScoreView> = new Map();

    public init(): void {
        this.views = new Map([
            [EScoreViewLayout.List, this.listScoreView],
            [EScoreViewLayout.Compare, this.compareScoreView],
        ]);
    }

    public build(sessionID: string, data: ScoresViewDto, meta?: Record<string, unknown>): TMessagePayload {
        const layout = data.layout ?? EScoreViewLayout.List;
        const view = this.getView(layout);

        const pageSize = view.getPageSize(data.pageSize, data.activeAttributes);
        const totalPages = Math.ceil(data.scores.length / pageSize) || 1;

        const start = (data.page - 1) * pageSize;
        const end = start + pageSize;
        const pageScores = data.scores.slice(start, end);

        const components = totalPages > 1 ? [Pagination.build("osu_scores", sessionID, data.page, totalPages)] : [];
        const embed = this.render(data, pageScores, meta);

        if (this.shouldShowActionButtons(data)) components.push(this.buildActionButtons(sessionID));

        return {
            content: data.displayQuery ?? undefined,
            embeds: [embed],
            components: components,
        };
    }

    public async prepare(data: ScoresViewDto, ctx: IScoreViewPopulateContext = {}): Promise<void> {
        const layout = data.layout ?? EScoreViewLayout.List;
        const mode = data.profile.mode;
        const provider = data.profile.provider;

        const pageSize = this.getPageSize(data.pageSize, data.activeAttributes, layout);
        await this.populatePage(data.scores, data.page, pageSize, mode, provider);

        if (!this.shouldPopulatePlacements(data)) {
            return;
        }

        const firstScore = data.scores[0];
        if (!firstScore || !ScoreUtils.hasMaps(firstScore)) {
            return;
        }

        await this.populateMissingPlacements(data.scores, mode, provider);

        const placedScores = await this.osuService.populateScorePlacements({
            scores: data.scores,
            userID: data.profile.id,
            mode,
            beatmap: firstScore.beatmap,
            provider,
            personalScores: ctx.personalScores,
            globalScores: ctx.globalScores,
        });

        data.scores.splice(0, data.scores.length, ...placedScores);
    }

    public render(data: ScoresViewDto, scores: Array<Score>, meta?: Record<string, unknown>): Embed {
        const layout = data.layout ?? EScoreViewLayout.List;
        const view = this.getView(layout);

        if (data.scores.length === 1 && scores[0]) {
            return view.renderSingle(data, scores[0]);
        }

        return view.render(data, scores, meta);
    }

    public afterRespond(data: ScoresViewDto, message: Message | InteractionResponse | null): void {
        if (!message || !this.shouldShowActionButtons(data)) {
            return;
        }

        setTimeout(() => {
            if (message instanceof Message && !message.components.length) {
                return;
            }

            message.edit({ components: [] }).catch(() => null);
        }, this.actionButtonsTtl * 1_000);
    }

    private shouldPopulatePlacements(data: ScoresViewDto): boolean {
        const layout = data.layout ?? EScoreViewLayout.List;
        return layout === EScoreViewLayout.Compare || data.scores.length === 1;
    }

    private async populateMissingPlacements(
        scores: Array<Score>,
        mode: GameMode,
        provider: AdapterProvider,
    ): Promise<void> {
        const missing = scores.filter((score) => ScoreUtils.pp(score) === undefined);
        if (!missing.length) {
            return;
        }

        const populated = await this.osuService.populateAll(missing, mode, true, provider);

        for (const populatedScore of populated) {
            const index = scores.findIndex((score) => ScoreUtils.compare(score, populatedScore));
            if (index !== -1) {
                scores.splice(index, 1, populatedScore);
            }
        }
    }

    public getPageSize(
        size: EScoreListSize,
        activeAttributes?: Array<string>,
        layout: EScoreViewLayout = EScoreViewLayout.List,
    ): number {
        return this.getView(layout).getPageSize(size, activeAttributes);
    }

    public async populatePage(
        scores: Array<Score>,
        page: number,
        pageSize: number,
        mode: GameMode,
        server: AdapterProvider,
    ): Promise<void> {
        const start = (page - 1) * pageSize;
        const slice = scores.slice(start, start + pageSize);

        if (slice.every((s) => ScoreUtils.isFullyPopulated(s))) {
            return;
        }

        const populated = await this.osuService.populateAll(slice, mode, true, server);
        scores.splice(start, populated.length, ...populated);
    }

    private getView(layout: EScoreViewLayout): AbstractScoreView {
        return this.views.get(layout) ?? this.listScoreView;
    }

    private shouldShowActionButtons(data: ScoresViewDto): boolean {
        const score = data.scores[0];
        return (
            data.scoreActions &&
            data.scores.length === 1 &&
            !!score &&
            ScoreUtils.allowsScoreActions(score, data.profile.mode, data.profile.provider)
        );
    }

    private buildActionButtons(sessionID: string): ActionRow {
        return new ActionRow()
            .addButton("Render", `osu_score_action:render:${sessionID}`, ButtonStyle.Secondary, { emoji: "🎥" })
            .addButton("Scorepost", `osu_score_action:scorepost:${sessionID}`, ButtonStyle.Secondary, { emoji: "🖨️" });
    }
}
