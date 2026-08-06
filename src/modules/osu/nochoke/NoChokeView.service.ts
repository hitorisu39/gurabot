import { Import } from "@/core/decorators";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { Pagination } from "@domain/discord/utils/Pagination";
import { NoChokeScore } from "@domain/osu/NoChoke.dto";
import { ScoreUtils } from "@domain/osu/utils/ScoreUtils";
import { NoChokeViewDto } from "@domain/osu/views/NoChoke.view";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { OsuService } from "../Osu.service";
import { NoChokeScoreView } from "./NoChokeScoreView.service";
import { plainToInstance } from "class-transformer";

export class NoChokeViewService extends AbstractViewService<NoChokeViewDto, Record<string, unknown>> {
    @Import()
    declare private readonly osuService: OsuService;

    @Import()
    declare private readonly noChokeScoreView: NoChokeScoreView;

    protected readonly ttl: number = 180;

    public build(sessionID: string, data: NoChokeViewDto): TMessagePayload {
        const pageSize = this.getPageSize();
        const totalPages = Math.ceil(data.scores.length / pageSize) || 1;

        const start = (data.page - 1) * pageSize;
        const pageScores = data.scores.slice(start, start + pageSize);

        const components = totalPages > 1 ? [Pagination.build("osu_nochoke", sessionID, data.page, totalPages)] : [];
        const removedChokes = data.scores.filter((score) => score.noChoke.applied).length;

        return {
            content: `Removed chokes from \`${removedChokes}\` top scores:`,
            embeds: [this.noChokeScoreView.render(data, pageScores)],
            components,
        };
    }

    public async prepare(data: NoChokeViewDto): Promise<void> {
        await this.populatePage(data.scores, data.page, data);
    }

    public getPageSize(): number {
        return this.noChokeScoreView.getPageSize();
    }

    public async populatePage(scores: Array<NoChokeScore>, page: number, data: NoChokeViewDto): Promise<void> {
        const pageSize = this.getPageSize();
        const start = (page - 1) * pageSize;
        const slice = scores.slice(start, start + pageSize);

        const missing = slice.filter((score) => !ScoreUtils.isFullyPopulated(score));

        if (!missing.length) {
            return;
        }

        const populated = await this.osuService.populateAll(missing, data.profile.mode, false, data.profile.provider);

        for (const populatedScore of populated) {
            const index = scores.findIndex((score) => ScoreUtils.compare(score, populatedScore));

            if (index === -1) {
                continue;
            }

            const existing = scores[index];

            if (!existing) {
                continue;
            }

            const merged = plainToInstance(NoChokeScore, {
                ...populatedScore,
                noChoke: existing.noChoke,
            });

            scores.splice(index, 1, merged);
        }
    }
}
