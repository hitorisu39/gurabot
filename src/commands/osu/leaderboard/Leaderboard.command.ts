import {
    Aliases,
    Command,
    Examples,
    Help,
    Import,
    Inject,
    IsBoolean,
    IsMods,
    IsString,
    Option,
} from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractSessionCommand } from "@/commands/AbstractSessionCommand";
import { OsuService } from "@/modules/osu/Osu.service";
import { CalculatorService } from "@/modules/osu/calculator/Calculator.service";
import { BeatmapResolverService } from "@/modules/osu/BeatmapResolver.service";
import { LeaderboardViewService } from "@/modules/osu/leaderboard/LeaderboardView.service";
import { CommandOption, ICommandMods } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { LeaderboardViewDto } from "@domain/osu/views/Leaderboard.view";
import { AdapterProvider } from "@generated/adapter/types";
import { ModUtils } from "@generated/adapter/mods";

@Help(`
    Shows the global leaderboard for a specific beatmap difficulty.

    A beatmap URL or ID can be provided directly. When providing a beatmapset
    URL or ID, use \`version\` to select a specific difficulty.

    **Beatmap Selection**
    Map: \`map=<url or id>\`, or provide the URL/ID directly.
    Version: \`version=<difficulty name>\`.

    **Leaderboard Options**
    Mods: \`mods=<mods>\`, or shorthand: \`+<mods>\`.
    Legacy scores only: \`legacy_only=true\`.
`)
@Examples(
    "leaderboard https://osu.ppy.sh/beatmaps/123456",
    "leaderboard 123456 +hddt",
)
@Command({
    name: "leaderboard",
    description: "Shows the global leaderboard for an osu! beatmap.",
    aliases: ["lb", "mapleaderboard"],
})
export class LeaderboardCommand extends AbstractSessionCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly calculatorService: CalculatorService;
    @Import() declare private readonly beatmapResolverService: BeatmapResolverService;
    @Import() declare private readonly leaderboardViewService: LeaderboardViewService;

    @Option("map", "Specify a beatmap or beatmapset URL or ID")
    @Inject()
    declare private readonly map: CommandOption<string>;

    @Option("version", "Specify a difficulty name from the beatmapset")
    @IsString()
    @Aliases("v")
    declare private readonly version: CommandOption<string>;

    @Option("mods", "Show the leaderboard for a specific mod combination")
    @IsMods()
    declare private readonly mods: CommandOption<ICommandMods>;

    @Option("legacy_only", "Only show legacy scores")
    @IsBoolean()
    @Aliases("legacy", "legacyonly")
    declare private readonly legacyOnly: CommandOption<boolean>;

    public async execute(ctx: CommandContext): Promise<void> {
        const provider = AdapterProvider.Bancho;

        const resolved = await this.beatmapResolverService.resolveTargetWithVersion(
            ctx,
            this.map,
            this.version,
            provider,
            "lowest",
        );

        if (!resolved.beatmapID) {
            throw new Exception(EApplicationError.NOT_FOUND, "Could not resolve the beatmap.");
        }

        const beatmap = await this.osuService.beatmap(resolved.beatmapID, provider);

        if (!beatmap?.beatmapset) {
            throw new Exception(EApplicationError.NOT_FOUND, "Beatmap or beatmapset information could not be found.");
        }

        const parsedMods = this.mods.some() ? ModUtils.fromString(this.mods.unwrap().mods) : [];

        const legacyOnly = this.legacyOnly.some() ? this.legacyOnly.unwrap() : false;

        const [scores, difficulty] = await Promise.all([
            this.osuService.beatmapScores(
                beatmap.id,
                beatmap.mode,
                parsedMods.length > 0 ? parsedMods : null,
                legacyOnly,
                provider,
            ),
            this.calculatorService.difficultyWithStrains(beatmap.id, beatmap.mode, parsedMods),
        ]);

        const data: LeaderboardViewDto = {
            timestamp: Date.now(),
            authorID: ctx.author.id,
            provider,
            beatmap,
            scores,
            starRating: difficulty.attributes.starRating,
            page: 1,
        };

        await this.leaderboardViewService.prepare(data);

        await this.respondWithSession(ctx, "osu_leaderboard_view", data, this.leaderboardViewService);
    }
}
