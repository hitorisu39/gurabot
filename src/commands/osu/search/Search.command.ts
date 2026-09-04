import { CommandContext } from "@/core/discord/context/CommandContext";
import {
    Category,
    Command,
    Examples,
    Help,
    Import,
    Inject,
    IsBoolean,
    IsEnum,
    IsString,
    Option,
} from "@/core/decorators";
import { AbstractSessionCommand } from "@/commands/AbstractSessionCommand";
import { OsuService } from "@/modules/osu/Osu.service";
import { CommandOption, ECommandCategory } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { SearchViewDto } from "@domain/osu/views/Search.view";
import {
    AdapterProvider,
    BeatmapSearchExtra,
    BeatmapSearchGeneral,
    BeatmapSearchSortField,
    BeatmapSearchSortOrder,
    BeatmapSearchStatus,
    GameMode,
    Genre,
    Language,
} from "@generated/adapter/types";
import { SearchViewService } from "@/modules/osu/search/SearchView.service";
import { IBeatmapsetSearchInput } from "@domain/osu/Adapter.dto";

const PublicBeatmapSearchStatus = {
    Any: BeatmapSearchStatus.Any,
    Leaderboard: BeatmapSearchStatus.Leaderboard,
    Ranked: BeatmapSearchStatus.Ranked,
    Qualified: BeatmapSearchStatus.Qualified,
    Loved: BeatmapSearchStatus.Loved,
    Pending: BeatmapSearchStatus.Pending,
    WIP: BeatmapSearchStatus.WIP,
    Graveyard: BeatmapSearchStatus.Graveyard,
} as const;

type TPublicBeatmapSearchStatus = (typeof PublicBeatmapSearchStatus)[keyof typeof PublicBeatmapSearchStatus];

@Help(`
    Searches osu! beatmapsets using the same search syntax as the beatmap page.
    Query filters such as \`stars>=5\`, \`bpm>180\`, \`ar=9\`, \`artist="Camellia"\` work normally.

    **Filters**
    \\- __\`mode\`__: \`standard\`, \`taiko\`, \`catch\`, \`mania\`
    \\- __\`status\`__: \`any\`, \`leaderboard\`, \`ranked\`, \`qualified\`, \`loved\`, \`pending\`, \`wip\`, \`graveyard\`
    \\- __\`genre\`__: \`any\`, \`unspecified\`, \`videoGame\`, \`anime\`, \`rock\`, \`pop\`, \`other\`, \`novelty\`, \`hipHop\`, \`electronic\`, \`metal\`, \`classical\`, \`folk\`, \`jazz\`
    \\- __\`language\`__: \`any\`, \`unspecified\`, \`other\`, \`english\`, \`japanese\`, \`chinese\`, \`instrumental\`, \`korean\`, \`french\`, \`german\`, \`swedish\`, \`spanish\`, \`italian\`, \`russian\`, \`polish\`
    \\- __\`nsfw\`__, __\`video\`__, __\`storyboard\`__, __\`converts\`__, __\`spotlights\`__, __\`featured_artists\`__: \`true\` / \`false\`

    **Sorting**
    \\- __\`sort\`__: \`artist\`, \`creator\`, \`difficulty\`, \`favourites\`, \`nominations\`, \`plays\`, \`ranked\`, \`rating\`, \`relevance\`, \`title\`, \`updated\`
    \\- __\`order\`__: \`asc\`, \`desc\` - requires \`sort\`

    Query filters and command filters can be combined freely.
`)
@Examples(
    "search freedom dive",
    "search camellia mode=standard status=ranked",
    "search mapper=someone sort=difficulty order=desc",
)
@Category(ECommandCategory.Osu)
@Command({
    name: "search",
    description: "Searches osu! beatmapsets.",
    aliases: ["mapsetsearch", "mapsearch"],
})
export class SearchCommand extends AbstractSessionCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly searchViewService: SearchViewService;

    @Option("query", "Search query")
    @Inject()
    @IsString()
    declare private readonly query: CommandOption<string>;

    @Option("mode", "Filter by game mode")
    @IsEnum(GameMode)
    declare private readonly mode: CommandOption<GameMode>;

    @Option("status", "Filter by beatmapset status")
    @IsEnum(PublicBeatmapSearchStatus)
    declare private readonly status: CommandOption<TPublicBeatmapSearchStatus>;

    @Option("genre", "Filter by genre")
    @IsEnum(Genre)
    declare private readonly genre: CommandOption<Genre>;

    @Option("language", "Filter by language")
    @IsEnum(Language)
    declare private readonly language: CommandOption<Language>;

    @Option("nsfw", "Include or exclude explicit beatmapsets")
    @IsBoolean()
    declare private readonly nsfw: CommandOption<boolean>;

    @Option("video", "Require a video")
    @IsBoolean()
    declare private readonly video: CommandOption<boolean>;

    @Option("storyboard", "Require a storyboard")
    @IsBoolean()
    declare private readonly storyboard: CommandOption<boolean>;

    @Option("converts", "Include converts")
    @IsBoolean()
    declare private readonly converts: CommandOption<boolean>;

    @Option("spotlights", "Only show spotlight beatmapsets")
    @IsBoolean()
    declare private readonly spotlights: CommandOption<boolean>;

    @Option("featured_artists", "Only show Featured Artist beatmapsets")
    @IsBoolean()
    declare private readonly featuredArtists: CommandOption<boolean>;

    @Option("sort", "Sort search results by a field")
    @IsEnum(BeatmapSearchSortField)
    declare private readonly sort: CommandOption<BeatmapSearchSortField>;

    @Option("order", "Specify sort direction")
    @IsEnum(BeatmapSearchSortOrder)
    declare private readonly order: CommandOption<BeatmapSearchSortOrder>;

    public async execute(ctx: CommandContext): Promise<void> {
        if (this.order.some() && !this.sort.some()) {
            throw new Exception(EApplicationError.INPUT_ERROR, "`order` can only be used together with `sort`.");
        }

        const extras: Array<BeatmapSearchExtra> = [];

        if (this.video.unwrapOr(false)) {
            extras.push(BeatmapSearchExtra.Video);
        }

        if (this.storyboard.unwrapOr(false)) {
            extras.push(BeatmapSearchExtra.Storyboard);
        }

        const general: Array<BeatmapSearchGeneral> = [];

        if (this.converts.unwrapOr(false)) {
            general.push(BeatmapSearchGeneral.Converts);
        }

        if (this.spotlights.unwrapOr(false)) {
            general.push(BeatmapSearchGeneral.Spotlights);
        }

        if (this.featuredArtists.unwrapOr(false)) {
            general.push(BeatmapSearchGeneral.FeaturedArtists);
        }

        const query = this.query.unwrapOr("").trim();

        const input: IBeatmapsetSearchInput = {
            query: query || undefined,
            mode: this.mode.unwrapUnchecked() ?? undefined,
            status: this.status.some() ? (this.status.unwrap() as BeatmapSearchStatus) : undefined,
            genre: this.genre.unwrapUnchecked() ?? undefined,
            language: this.language.unwrapUnchecked() ?? undefined,
            nsfw: this.nsfw.some() ? this.nsfw.unwrap() : undefined,
            extras: extras.length ? extras : undefined,
            general: general.length ? general : undefined,
            sort: this.sort.some()
                ? {
                      field: this.sort.unwrap(),
                      order: this.order.unwrapUnchecked() ?? undefined,
                  }
                : undefined,
        };

        const result = await this.osuService.search(input, AdapterProvider.Bancho);

        if (result.error) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, result.error);
        }

        if (!result.beatmapsets.length) {
            throw new Exception(EApplicationError.NOT_FOUND, "No beatmapsets were found with these search parameters.");
        }

        const data: SearchViewDto = {
            authorID: ctx.author.id,
            input,
            beatmapsets: result.beatmapsets,
            total: result.total,
            page: 1,
            cursorString: result.cursorString,
        };

        await this.respondWithSession(ctx, "osu_search_view", data, this.searchViewService);
    }
}
