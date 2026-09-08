import { Import } from "@/core/decorators";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { Embed } from "@/core/discord/ui/Embed";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { Pagination } from "@domain/discord/utils/Pagination";
import { otrLeaderboardPageSize } from "@domain/otr/configs/OtrLeaderboard.config";
import { OtrLeaderboardFormatter } from "@domain/otr/formatters/OtrLeaderboard.formatter";
import { OtrLeaderboardViewDto } from "@domain/otr/views/OtrLeaderboard.view";
import { OtrService } from "../api/Otr.service";
import { otrRulesetLabel } from "@domain/otr/configs/Otr.config";

export class OtrLeaderboardViewService extends AbstractViewService<OtrLeaderboardViewDto, Record<string, unknown>> {
    @Import() declare private readonly otrService: OtrService;

    protected readonly ttl = 180;

    public async prepare(data: OtrLeaderboardViewDto): Promise<void> {
        const response = await this.otrService.leaderboard({
            page: data.page,
            pageSize: otrLeaderboardPageSize,
            ruleset: data.ruleset,
            country: data.country,
        });

        data.page = response.page;
        data.ruleset = response.ruleset;
        data.response = response;
    }

    public getTotalPages(data: OtrLeaderboardViewDto): number {
        return Math.max(1, data.response?.pages ?? 1);
    }

    public build(sessionID: string, data: OtrLeaderboardViewDto): TMessagePayload {
        const response = data.response;
        const totalPages = this.getTotalPages(data);
        const ruleset = otrRulesetLabel[data.ruleset];
        const scope = data.country ? `${data.country} leaderboard` : "Global leaderboard";

        const query = new URLSearchParams({
            ruleset: String(data.ruleset),
            ...(data.country ? { country: data.country } : {}),
        });

        const embed = new Embed()
            .setAuthor({ name: `${ruleset} • ${scope}`, url: `https://otr.stagec.net/leaderboard?${query}` })
            .setDescription(OtrLeaderboardFormatter.entries(response?.leaderboard ?? [], Boolean(data.country)))
            .setFooter({
                text: `o!TR • ${DiscordFormatter.number(response?.total ?? 0)} rated players`,
            });

        return {
            embeds: [embed],
            components: totalPages > 1 ? [Pagination.build("otr_leaderboard", sessionID, data.page, totalPages)] : [],
        };
    }
}
