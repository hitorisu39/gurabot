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
import { AbstractOsuCommand } from "@/commands/osu/AbstractOsuCommand";
import { EFarmRecommendSort, EFarmSort, IFarmRecommendOverrides } from "@domain/farm/Farm.types";
import { CommandOption, ECommandCategory, ICommandDateRange, ICommandMods, ICommandRange } from "@domain/core/Command";
import { FarmRecommendViewDto } from "@domain/farm/views/FarmRecommend.view";
import { FarmRecommendService } from "@/modules/farm/FarmRecommend.service";
import { FarmRecommendViewService } from "@/modules/farm/FarmRecommendView.service";
import { FarmMapsService } from "@/modules/farm/FarmMaps.service";
import { FarmMapsViewService } from "@/modules/farm/FarmMapsView.service";
import { FarmMapsViewDto } from "@domain/farm/views/FarmMaps.view";

@Help(`
    Recommends farm maps based on the player's top plays.
    Recommendation ranges are inferred automatically, and any filters you provide override the inferred value for that attribute.

    **Filters**
    \\- __\`pp\`__: average top-play PP range, e.g. \`pp>=400\`, \`pp=350-500\`
    \\- __\`length\`__: effective map length in seconds, e.g. \`length<180\`, \`length=120-300\`
    \\- __\`bpm\`__: effective BPM, e.g. \`bpm>=200\`, \`bpm=180-240\`
    \\- __\`stars\`__: base (nomod) star rating, e.g. \`stars>=6\`, \`stars=6.5-7.5\`
    \\- __\`ar\`__: effective approach rate, e.g. \`ar>=9.5\`, \`ar=9-10.5\`
    \\- __\`cs\`__: circle size, e.g. \`cs=4\`, \`cs=3.5-5\`
    \\- __\`od\`__: overall difficulty, e.g. \`od>=9\`, \`od=8.5-10\`
    \\- __\`hp\`__: HP drain, e.g. \`hp>=5\`, \`hp=4-7\`
    \\- __\`ranked\`__: ranked date or date range, e.g. \`ranked>=2020\`, \`ranked=2020..2024\`
    \\- __\`mods\`__: mod filter; \`+HD\` includes HD, \`+HD!\` matches HD exactly, \`-HD\` excludes HD

    **Sorting**
    \\- __\`sort\`__: \`random\`, \`farmability\`

    By default, \`pp\`, \`length\`, \`bpm\`, \`ar\`, \`cs\`, \`od\`, and \`hp\` are inferred from the player's top plays.
    \`stars\`, \`ranked\`, and \`mods\` are only filtered when explicitly provided.

    Filters can be combined freely, for example: \`rec +DT bpm>=200 length<180 sort=farmability\`.
`)
@Examples("rec", "rec pp>=350 bpm>=180 +hd", "rec length<120 ar>=9.5 sort=farmability")
@Category(ECommandCategory.Osu)
export abstract class AbstractFarmRecommendCommand extends AbstractOsuCommand {
    @Import() declare private readonly farmRecommendService: FarmRecommendService;
    @Import() declare private readonly farmRecommendViewService: FarmRecommendViewService;
    @Import() declare private readonly farmMapsService: FarmMapsService;
    @Import() declare private readonly farmMapsViewService: FarmMapsViewService;

    @Option("pp", "Override the inferred PP range, e.g. pp>=400, pp=100-300")
    @IsRange()
    declare private readonly pp: CommandOption<ICommandRange>;

    @Option("length", "Override the inferred map length range in seconds, e.g. length<180")
    @IsRange()
    declare private readonly length: CommandOption<ICommandRange>;

    @Option("bpm", "Override the inferred effective BPM range, e.g. bpm>=200")
    @IsRange()
    declare private readonly bpm: CommandOption<ICommandRange>;

    @Option("stars", "Filter by base (nomod) star rating, e.g. stars=6.5-7.5")
    @IsRange()
    declare private readonly stars: CommandOption<ICommandRange>;

    @Option("ranked", "Filter by ranked date, e.g. ranked>=2020")
    @IsDateRange()
    @Aliases("rankdate")
    declare private readonly ranked: CommandOption<ICommandDateRange>;

    @Option("ar", "Override the inferred effective AR range, e.g. ar>=9.5")
    @IsRange()
    declare private readonly ar: CommandOption<ICommandRange>;

    @Option("cs", "Override the inferred CS range, e.g. cs=3.5-5")
    @IsRange()
    declare private readonly cs: CommandOption<ICommandRange>;

    @Option("od", "Override the inferred OD range, e.g. od>=9")
    @IsRange()
    declare private readonly od: CommandOption<ICommandRange>;

    @Option("hp", "Override the inferred HP range, e.g. hp=4-7")
    @IsRange()
    declare private readonly hp: CommandOption<ICommandRange>;

    @Option("mods", "Filter recommendations by mods, e.g. +HD, +HD!, -HD")
    @IsMods()
    declare private readonly mods: CommandOption<ICommandMods>;

    @Option("sort", "Recommendation sort, e.g. random, farmability")
    @IsEnum(EFarmRecommendSort)
    declare private readonly sort: CommandOption<EFarmRecommendSort>;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const result = await this.farmRecommendService.profile({
            nameOrID: target.query,
            mode: target.mode,
            provider: target.server,
            overrides: this.overrides(),
        });

        if (result.query.sort === EFarmSort.Farmability) {
            const data: FarmMapsViewDto = {
                authorID: ctx.author.id,
                mode: target.mode,
                query: result.query,
                maps: [],
                page: 1,
                lastPage: undefined,
            };

            await this.farmMapsService.populatePage(data);
            await this.respondWithSession(ctx, "osu_farm_maps_view", data, this.farmMapsViewService);
            return;
        }

        const recommendations = await this.farmRecommendService.recommendations(result.query);
        const data: FarmRecommendViewDto = {
            timestamp: Date.now(),
            authorID: ctx.author.id,
            profile: result.profile,
            query: result.query,
            recommendations,
        };

        await this.respondWithSession(ctx, "osu_farm_recommend_view", data, this.farmRecommendViewService);
    }

    private overrides(): IFarmRecommendOverrides {
        return {
            pp: this.pp.unwrapUnchecked(),
            length: this.length.unwrapUnchecked(),
            bpm: this.bpm.unwrapUnchecked(),
            stars: this.stars.unwrapUnchecked(),
            ranked: this.ranked.unwrapUnchecked(),
            ar: this.ar.unwrapUnchecked(),
            cs: this.cs.unwrapUnchecked(),
            od: this.od.unwrapUnchecked(),
            hp: this.hp.unwrapUnchecked(),
            mods: this.mods.unwrapUnchecked(),
            sort: this.sort.unwrapOr(EFarmRecommendSort.Random),
        };
    }
}
