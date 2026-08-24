import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { ActionRow } from "@/core/discord/ui/ActionRow";
import { Embed } from "@/core/discord/ui/Embed";
import { SelectMenu } from "@/core/discord/ui/SelectMenu";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { Pagination } from "@domain/discord/utils/Pagination";
import { snipeBaseUrl, snipeRankingPageSize, snipeRankingSortLabel } from "@domain/snipe/configs/Snipe.config";
import { ESnipeRankingSort } from "@domain/snipe/enums/Snipe.enum";
import { SnipeFormatter } from "@domain/snipe/formatters/Snipe.formatter";
import { SnipeRankingViewDto } from "@domain/snipe/views/SnipeRanking.view";

export class SnipeRankingViewService extends AbstractViewService<SnipeRankingViewDto> {
    protected readonly ttl = 180;

    public build(sessionID: string, data: SnipeRankingViewDto): TMessagePayload {
        const totalPages = Math.max(1, Math.ceil(data.players.length / snipeRankingPageSize));
        const start = (data.page - 1) * snipeRankingPageSize;
        const players = data.players.slice(start, start + snipeRankingPageSize);

        const description = players
            .map((player, index) => SnipeFormatter.rankingPlayer(player, start + index + 1))
            .join("\n");

        const scope = data.country === "global" ? "Global leaderboard" : `${data.country.toUpperCase()} leaderboard`;
        const embed = new Embed()
            .setAuthor({
                name: `osu!snipe • ${scope}`,
                url: snipeBaseUrl,
            })
            .setDescription(description)
            .setFooter({
                text: `${data.players.length} players • Sorted by ${snipeRankingSortLabel[data.sort]}`,
            });

        const components: Array<ActionRow> = [this.sortMenu(sessionID, data.sort)];
        if (totalPages > 1) {
            components.push(Pagination.build("snipe_ranking", sessionID, data.page, totalPages));
        }

        return {
            embeds: [embed],
            components,
        };
    }

    private sortMenu(sessionID: string, current: ESnipeRankingSort): ActionRow {
        const menu = new SelectMenu(`snipe_ranking_sort:${sessionID}`)
            .setPlaceholder("Sort leaderboard...")
            .setCurrent(current)
            .addChoice("Weighted PP", ESnipeRankingSort.WeightedPP, "Weighted national #1 performance")
            .addChoice("#1 Count", ESnipeRankingSort.Count, "Total national #1 scores")
            .addChoice("Average PP", ESnipeRankingSort.AveragePP, "Average PP of national #1 scores")
            .addChoice("Average Stars", ESnipeRankingSort.AverageStars, "Average difficulty of national #1 scores");

        return new ActionRow().add(menu);
    }
}
