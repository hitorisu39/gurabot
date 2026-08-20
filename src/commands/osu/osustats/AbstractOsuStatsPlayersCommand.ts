import { Category, Examples, Help, Import, IsEnum, IsRange, IsString, Option } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { CommandOption, ECommandCategory, ICommandRange } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { GameMode } from "@generated/adapter/types";
import { OsuStatsService } from "@/modules/osustats/OsuStats.service";
import { OsuStatsPlayersViewDto } from "@domain/osustats/views/OsuStatsPlayers.view";
import { OsuStatsPlayersViewService } from "@/modules/osustats/OsuStatsPlayersView.service";
import { AbstractSessionCommand } from "@/commands/AbstractSessionCommand";
import { osuStatsPlayersPageSize } from "@domain/osustats/configs/OsuStats.config";

@Help(`
    Ranks players by how often they appear on {mode} map global leaderboards.

    **Filters**
    Rank: \`rank=<range>\` controls which map leaderboard positions are counted.
    Country: \`country=<code>\` restricts the ranking to a two-letter country code.

    Examples of rank filters: \`rank<=10\`, \`rank=1\`, \`rank>=25\`.
`)
@Examples("osustatsplayers", "osp rank<=10", "osp country=US rank=1")
@Category(ECommandCategory.Osu)
export class AbstractOsuStatsPlayersCommand extends AbstractSessionCommand {
    @Import() declare private readonly osuStatsService: OsuStatsService;
    @Import() declare private readonly osuStatsPlayersViewService: OsuStatsPlayersViewService;

    @Option("mode", "Specify game mode")
    @IsEnum(GameMode)
    declare private readonly mode: CommandOption<GameMode>;

    @Option("country", "Two-letter country code")
    @IsString(2, 2)
    declare private readonly country: CommandOption<string>;

    @Option("rank", "Specify leaderboard position range (e.g., 1, 1-8)")
    @IsRange(1, 100)
    declare private readonly rank: CommandOption<ICommandRange>;

    public async execute(ctx: CommandContext): Promise<void> {
        const mode = this.mode.unwrapOr(GameMode.Standard);
        const countryRaw = this.country.unwrapOr("");
        const country = countryRaw ? countryRaw.toUpperCase() : undefined;

        const { minRank, maxRank } = this.resolveRankRange(this.rank.unwrapUnchecked());

        const input = {
            mode,
            country,
            minRank,
            maxRank,
        };

        const firstPage = await this.osuStatsService.players({
            ...input,
            page: 1,
        });

        if (!firstPage.players.length) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                "No osu!stats leaderboard entries were found with these parameters.",
            );
        }

        const data: OsuStatsPlayersViewDto = {
            authorID: ctx.author.id,
            mode,
            country,
            minRank,
            maxRank,
            page: 1,
            players: firstPage.players,
        };

        if (firstPage.players.length < osuStatsPlayersPageSize) {
            data.lastPage = 1;
        }

        await this.respondWithSession(ctx, "osustats_players_view", data, this.osuStatsPlayersViewService);
    }

    private resolveRankRange(range?: ICommandRange | null): { minRank: number; maxRank: number } {
        if (!range) {
            return {
                minRank: 1,
                maxRank: 100,
            };
        }

        if (range.exact !== undefined) {
            return {
                minRank: range.exact,
                maxRank: range.exact,
            };
        }

        const minRank = range.min + (range.minInclusive ? 0 : 1);
        const maxRank = range.max - (range.maxInclusive ? 0 : 1);

        if (minRank > maxRank) {
            throw new Exception(EApplicationError.INPUT_ERROR, "The leaderboard rank range contains no positions.");
        }

        return {
            minRank,
            maxRank,
        };
    }
}
