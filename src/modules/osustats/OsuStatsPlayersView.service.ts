import { Import } from "@/core/decorators";
import { Embed } from "@/core/discord/ui/Embed";
import { TMessagePayload } from "@/core/discord/context/CommandContext";

import { AbstractViewService } from "@/modules/AbstractViewService";
import { OsuStatsService } from "@/modules/osustats/OsuStats.service";

import { Pagination } from "@domain/discord/utils/Pagination";
import { OsuStatsPlayersViewDto } from "@domain/osustats/views/OsuStatsPlayers.view";
import { OsuStatsFormatter } from "@domain/osustats/formatters/OsuStats.formatter";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { OsuStatsPlayerDto } from "@domain/osustats/OsuStatsPlayers.dto";
import { osuStatsBaseUrl } from "@domain/osustats/configs/OsuStats.config";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { AdapterProvider } from "@generated/adapter/types";

export class OsuStatsPlayersViewService extends AbstractViewService<OsuStatsPlayersViewDto> {
    @Import() declare private readonly osuStatsService: OsuStatsService;

    protected readonly ttl = 180;

    public async prepare(data: OsuStatsPlayersViewDto): Promise<void> {
        const result = await this.osuStatsService.players({
            mode: data.mode,
            country: data.country,
            minRank: data.minRank,
            maxRank: data.maxRank,
            page: data.page,
        });

        data.players = result.players;
    }

    public build(sessionID: string, data: OsuStatsPlayersViewDto): TMessagePayload {
        const components = [Pagination.buildLazy("osustats_players", sessionID, data.page, data.lastPage)];
        const description = data.players.map((player) => OsuStatsFormatter.player(player)).join("\n");

        const authorIcon = data.country
            ? DiscordFormatter.countryFlag(this.config.app.flagsDomain, data.country)
            : undefined;

        const embed = new Embed()
            .setAuthor({
                name: "osu!stats • players",
                iconURL: authorIcon,
                url: `${osuStatsBaseUrl}/r`,
            })
            .setDescription(description || "No players.");

        const first = data.players[0];
        if (first) {
            embed.setThumbnail(ProfileFormatter.avatar(AdapterProvider.Bancho, first.userID));
        }

        return {
            content: OsuStatsFormatter.playersFilters(data.mode, data.country, data.minRank, data.maxRank),
            embeds: [embed],
            components,
        };
    }

    public async fetchPage(data: OsuStatsPlayersViewDto, page: number): Promise<Array<OsuStatsPlayerDto>> {
        const result = await this.osuStatsService.players({
            mode: data.mode,
            country: data.country,
            minRank: data.minRank,
            maxRank: data.maxRank,
            page,
        });

        return result.players;
    }
}
