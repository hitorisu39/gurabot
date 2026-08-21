import { Import } from "@/core/decorators";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { Pagination } from "@domain/discord/utils/Pagination";
import { EModMatchType, ICommandMods } from "@domain/core/Command";
import { TopIfScore } from "@domain/osu/TopIf.dto";
import { TopIfViewDto } from "@domain/osu/views/TopIf.view";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { OsuService } from "@/modules/osu/Osu.service";
import { TopIfScoreView } from "./TopIfScoreView.service";
import { plainToInstance } from "class-transformer";
import { TextFormatter } from "@domain/discord/formatters/Text.formatter";

export class TopIfViewService extends AbstractViewService<TopIfViewDto> {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly topIfScoreView: TopIfScoreView;

    protected readonly ttl: number = 180;

    public build(sessionID: string, data: TopIfViewDto): TMessagePayload {
        const pageSize = this.getPageSize();
        const totalPages = Math.ceil(data.scores.length / pageSize) || 1;

        const start = (data.page - 1) * pageSize;
        const pageScores = data.scores.slice(start, start + pageSize);

        const components = totalPages > 1 ? [Pagination.build("osu_topif", sessionID, data.page, totalPages)] : [];

        return {
            content:
                `${TextFormatter.possessive(data.profile.username, true)} top scores ` +
                `${this.formatTransformSummary(data.operations)}:`,
            embeds: [this.topIfScoreView.render(data, pageScores)],
            components,
        };
    }

    public async prepare(data: TopIfViewDto): Promise<void> {
        await this.populatePage(data.scores, data.page, data);
    }

    public getPageSize(): number {
        return this.topIfScoreView.getPageSize();
    }

    public async populatePage(scores: Array<TopIfScore>, page: number, data: TopIfViewDto): Promise<void> {
        const pageSize = this.getPageSize();
        const start = (page - 1) * pageSize;
        const slice = scores.slice(start, start + pageSize);

        const missing = slice.filter((score) => score.calculatedFC === undefined);
        if (!missing.length) {
            return;
        }

        const populated = await this.osuService.populateCalculations(missing, data.profile.mode, true);

        for (const [index, populatedScore] of populated.entries()) {
            const existing = missing[index];

            if (!existing) {
                continue;
            }

            const scoreIndex = scores.indexOf(existing);

            if (scoreIndex === -1) {
                continue;
            }

            const merged = plainToInstance(TopIfScore, {
                ...existing,
                fullDifficulty: populatedScore.fullDifficulty,
                calculatedFC: populatedScore.calculatedFC,
            });

            scores.splice(scoreIndex, 1, merged);
        }
    }

    private formatTransformSummary(operations: ReadonlyArray<ICommandMods>): string {
        let replacementIndex = -1;

        for (const [index, operation] of operations.entries()) {
            if (operation.type === EModMatchType.Match) {
                replacementIndex = index;
            }
        }

        const relevant = replacementIndex === -1 ? operations : operations.slice(replacementIndex + 1);

        const applied = relevant
            .filter((operation) => operation.type !== EModMatchType.Match && operation.type !== EModMatchType.Exclude)
            .map((operation) => operation.mods)
            .join("");

        const removed = relevant
            .filter((operation) => operation.type === EModMatchType.Exclude)
            .map((operation) => operation.mods)
            .join("");

        const clauses: Array<string> = [];

        if (replacementIndex !== -1) {
            const replacement = operations[replacementIndex];

            if (replacement) {
                clauses.push(`all mods changed to \`${replacement.mods}\``);
            }
        }

        if (applied) {
            clauses.push(`\`${applied}\` applied`);
        }

        if (removed) {
            clauses.push(`\`${removed}\` removed`);
        }

        if (!clauses.length) {
            return "with the requested mod changes applied";
        }

        return `with ${TextFormatter.joinClauses(clauses)}`;
    }
}
