import { Import, IsEnum, IsMods, Option, Subcommand } from "@/core/decorators";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { OsuService } from "@/modules/osu/Osu.service";
import { SnipeService } from "@/modules/snipe/Snipe.service";
import { CommandOption, ICommandMods } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ESortOrder } from "@domain/osu/enums/Score.enum";
import { ESnipePlayerListSort } from "@domain/snipe/enums/Snipe.enum";
import { SnipePlayerListViewService } from "@/modules/snipe/SnipePlayerListView.service";
import { SnipePlayerListViewDto } from "@domain/snipe/views/SnipePlayerList.view";

@Subcommand({
    root: "snipe",
    group: "player",
    name: "list",
    description: "Lists a player's national #1 scores.",
})
export class SnipePlayerListSubcommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly snipeService: SnipeService;
    @Import() declare private readonly snipePlayerListViewService: SnipePlayerListViewService;

    @Option("sort", "Metric used to sort the scores.")
    @IsEnum(ESnipePlayerListSort)
    declare private readonly sort: CommandOption<ESnipePlayerListSort>;

    @Option("order", "Sort direction.")
    @IsEnum(ESortOrder)
    declare private readonly order: CommandOption<ESortOrder>;

    @Option("mods", "Filter national #1s by mods.")
    @IsMods()
    declare private readonly mods: CommandOption<ICommandMods>;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);

        const profile = await this.osuService.user(target.query, target.mode);
        const sort = this.sort.unwrapOr(ESnipePlayerListSort.PP);
        const order = this.order.unwrapOr(ESortOrder.Descending);
        const mods = this.mods.some() ? this.mods.unwrap().mods : undefined;

        const [total, firstPage] = await Promise.all([
            this.snipeService.playerScoreCount(profile.id, profile.countryCode, mods),
            this.snipeService.playerScores({
                userID: profile.id,
                country: profile.countryCode,
                page: 1,
                sort,
                order,
                mods,
            }),
        ]);

        if (!total) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                `${profile.username} does not have any matching national #1s.`,
            );
        }

        const data: SnipePlayerListViewDto = {
            timestamp: Date.now(),
            authorID: ctx.author.id,
            profile,
            sort,
            order,
            mods,
            page: 1,
            apiPage: 1,
            total,
            scores: firstPage.scores,
        };

        await this.respondWithSession(ctx, "snipe_player_list_view", data, this.snipePlayerListViewService);
    }
}
