import {
    Aliases,
    Category,
    Examples,
    Help,
    Import,
    IsDateRange,
    IsEnum,
    IsMods,
    IsRange,
    Option,
} from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { CommandOption, ECommandCategory, ICommandDateRange, ICommandMods, ICommandRange } from "@domain/core/Command";
import { EFarmSort, EFarmSortOrder, IFarmMapQuery, IFarmModsQuery } from "@domain/farm/Farm.types";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { FarmMapsService } from "@/modules/farm/FarmMaps.service";
import { FarmMapsViewService } from "@/modules/farm/FarmMapsView.service";
import { ModUtils } from "@generated/adapter/mods";
import { FarmMapsViewDto } from "@domain/farm/views/FarmMaps.view";
import { GameMode } from "@generated/adapter/types";

@Help(`
    Browses farm maps from the osu!pps dataset.
    Unlike \`/farm recommend\`, no filters are inferred from a player's top plays.

    **Filters**
    \\- __\`pp\`__: average top-play PP, e.g. \`pp>=400\`, \`pp=350-500\`
    \\- __\`length\`__: effective map length in seconds, e.g. \`length<180\`, \`length=120-300\`
    \\- __\`bpm\`__: effective BPM, e.g. \`bpm>=200\`, \`bpm=180-240\`
    \\- __\`stars\`__: osu!pps star rating, e.g. \`stars>=6\`, \`stars=6.5-7.5\`
    \\- __\`ar\`__: effective approach rate, e.g. \`ar>=9.5\`, \`ar=9-10.5\`
    \\- __\`cs\`__: circle size, e.g. \`cs=4\`, \`cs=3.5-5\`
    \\- __\`od\`__: overall difficulty, e.g. \`od>=9\`, \`od=8.5-10\`
    \\- __\`hp\`__: HP drain, e.g. \`hp>=5\`, \`hp=4-7\`
    \\- __\`ranked\`__: ranked date or date range, e.g. \`ranked>=2020\`, \`ranked=2020..2024\`
    \\- __\`mods\`__: \`+HD\` includes HD, \`+HD!\` matches HD exactly, \`-HD\` excludes HD

    **Sorting**
    \\- __\`sort\`__: \`random\`, \`farmability\`, \`stars\`, \`bpm\`, \`length\`, \`pp\`, \`ranked\`
    \\- __\`order\`__: \`asc\`, \`desc\`; ignored for \`sort=random\`

    Defaults to \`sort=farmability order=desc\`.
    Filters can be combined freely.
`)
@Examples(
    "farmmaps",
    "farmmaps +dt bpm>=200 length<180",
    "farmmaps stars=6.5..7.5 sort=pp order=desc",
    "farmmaps ranked>=2024 sort=ranked order=desc",
)
@Category(ECommandCategory.Osu)
export abstract class AbstractFarmMapsCommand extends AbstractCommand {
    @Import() declare private readonly farmMapsService: FarmMapsService;
    @Import() declare private readonly farmMapsViewService: FarmMapsViewService;

    @Option("mode", "Specify osu! gamemode")
    @IsEnum(GameMode)
    declare protected readonly mode: CommandOption<GameMode>;

    @Option("pp", "Filter by average top-play PP")
    @IsRange()
    declare private readonly pp: CommandOption<ICommandRange>;

    @Option("length", "Filter by effective map length in seconds")
    @IsRange()
    declare private readonly length: CommandOption<ICommandRange>;

    @Option("bpm", "Filter by effective BPM")
    @IsRange()
    declare private readonly bpm: CommandOption<ICommandRange>;

    @Option("stars", "Filter by osu!pps star rating")
    @IsRange()
    declare private readonly stars: CommandOption<ICommandRange>;

    @Option("ranked", "Filter by ranked date")
    @IsDateRange()
    @Aliases("rankdate")
    declare private readonly ranked: CommandOption<ICommandDateRange>;

    @Option("ar", "Filter by effective AR")
    @IsRange()
    declare private readonly ar: CommandOption<ICommandRange>;

    @Option("cs", "Filter by CS")
    @IsRange()
    declare private readonly cs: CommandOption<ICommandRange>;

    @Option("od", "Filter by OD")
    @IsRange()
    declare private readonly od: CommandOption<ICommandRange>;

    @Option("hp", "Filter by HP")
    @IsRange()
    declare private readonly hp: CommandOption<ICommandRange>;

    @Option("mods", "Filter by mods")
    @IsMods()
    declare private readonly mods: CommandOption<ICommandMods>;

    @Option("sort", "Sort farm maps")
    @IsEnum(EFarmSort)
    declare private readonly sort: CommandOption<EFarmSort>;

    @Option("order", "Sort direction")
    @IsEnum(EFarmSortOrder)
    declare private readonly order: CommandOption<EFarmSortOrder>;

    public async execute(ctx: CommandContext): Promise<void> {
        const sort = this.sort.unwrapOr(EFarmSort.Farmability);

        const query: IFarmMapQuery = {
            mode: this.mode.unwrapOr(GameMode.Standard),
            pp: this.pp.unwrapUnchecked(),
            length: this.length.unwrapUnchecked(),
            bpm: this.bpm.unwrapUnchecked(),
            stars: this.stars.unwrapUnchecked(),
            ranked: this.ranked.unwrapUnchecked(),
            ar: this.ar.unwrapUnchecked(),
            cs: this.cs.unwrapUnchecked(),
            od: this.od.unwrapUnchecked(),
            hp: this.hp.unwrapUnchecked(),
            mods: this.mods.some() ? this.modsQuery(this.mods.unwrap()) : undefined,
            sort,
            order: this.order.unwrapOr(EFarmSortOrder.Descending),
            randomSeed: sort === EFarmSort.Random ? Math.floor(Math.random() * 2_147_483_647) : undefined,
        };

        const data: FarmMapsViewDto = {
            timestamp: Date.now(),
            authorID: ctx.author.id,
            mode: this.mode.unwrapOr(GameMode.Standard),
            query,
            maps: [],
            page: 1,
        };

        await this.farmMapsService.populatePage(data);
        await this.respondWithSession(ctx, "osu_farm_maps_view", data, this.farmMapsViewService);
    }

    private modsQuery(mods: ICommandMods): IFarmModsQuery {
        const bits = ModUtils.isNoMod(mods.mods) ? 0 : ModUtils.toBits(ModUtils.fromString(mods.mods));

        return {
            type: mods.type,
            bits,
        };
    }
}
