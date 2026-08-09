import { AbstractSessionCommand } from "@/commands/AbstractSessionCommand";
import { CommandContext } from "@/core/discord/context/CommandContext";
import {
    Aliases,
    Category,
    Command,
    Examples,
    Help,
    Import,
    Inject,
    IsMods,
    IsQuery,
    IsString,
    Option,
} from "@/core/decorators";
import { BeatmapResolverService } from "@/modules/osu/BeatmapResolver.service";
import { OsuService } from "@/modules/osu/Osu.service";
import { SimulateViewService } from "@/modules/osu/simulate/SimulateView.service";
import { CommandOption, ECommandCategory, ICommandMods, ICommandQueryData } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ESimulateScoringMode } from "@domain/osu/enums/Simulate.enum";
import { SimulateViewDto } from "@domain/osu/views/Simulate.view";
import { ModUtils } from "@generated/adapter/mods";
import { AdapterProvider } from "@generated/adapter/types";
import { SimulateParametersParser } from "@domain/osu/utils/SimulateParametersParser";
import { SimulateQueryDto } from "@domain/osu/Simulate.dto";
import { BeatmapUtils } from "@domain/osu/utils/BeatmapUtils";

@Help(`
    Simulates a score on a beatmap linked in the command or stored in the channel.

    Available arguments:
    - Accuracy: \`acc=[number]\` or \`[number]%\`
    - Combo: \`combo=[integer]\` or \`[integer]x\`
    - Clock rate: \`clockrate=[number]\`, \`rate=[number]\`, or \`[number]*\`
    - BPM: \`bpm=[number]\` (only if clock rate is not specified)
    - 300s: \`n300=[integer]\` or \`[integer]x300\`
    - 100s: \`n100=[integer]\` or \`[integer]x100\`
    - 50s: \`n50=[integer]\` or \`[integer]x50\`
    - Misses: \`miss=[integer]\` or \`[integer]m\`
    - Gekis / 320s: \`gekis=[integer]\` or \`[integer]xgeki\`
    - Katus / 200s / tiny droplet misses: \`katus=[integer]\` or \`[integer]xkatu\`
    - Missed slider ends: \`sliderends=[integer]\` or \`[integer]xsliderends\`
    - Missed large ticks: \`largeticks=[integer]\` or \`[integer]xlargeticks\`
    - Small ticks: \`smallticks=[integer]\` or \`[integer]xsmallticks\`
    - Stable score: \`score=[integer]\`
    - Mods: \`mods=[mod acronyms]\` or \`+[mod acronyms]\`
    - Approach rate: \`ar=[number]\` or \`ar[number]\`
    - Circle size: \`cs=[number]\` or \`cs[number]\`
    - HP drain: \`hp=[number]\` or \`hp[number]\`
    - Overall difficulty: \`od=[number]\` or \`od[number]\`
    - Scoring mode: \`lazer=[boolean]\` or \`stable=[boolean]\`

    BPM and clock rate cannot be specified together.
    Stable score can only be specified when using stable scoring.
    Some hit-result arguments are only available for specific game modes.
`)
@Examples(
    "simulate 123456 98.5% 800x +HDDT",
    "simulate acc=98.5 combo=800 n100=4 miss=1",
    "simulate bpm=240 ar10 od9.5 +HD",
    "simulate stable=true score=987654",
    "simulate 4x100 1m",
)
@Category(ECommandCategory.Osu)
@Command({
    name: "simulate",
    description: "Simulates a score on a beatmap.",
    aliases: ["sim", "s"],
})
export class SimulateCommand extends AbstractSessionCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly beatmapResolverService: BeatmapResolverService;
    @Import() declare private readonly simulateViewService: SimulateViewService;

    @Option("map", "Specify a map URL or ID")
    declare private readonly map: CommandOption<string>;

    @Option("version", "Specify a difficulty name in the mapset")
    @IsString()
    @Aliases("v")
    declare private readonly version: CommandOption<string>;

    @Option("mods", "Apply mods to the simulation")
    @IsMods()
    declare private readonly mods: CommandOption<ICommandMods>;

    @Option("query", "Apply simulation parameters")
    @IsQuery(SimulateQueryDto)
    @Inject()
    declare private readonly query: CommandOption<ICommandQueryData<SimulateQueryDto>>;

    public async execute(ctx: CommandContext): Promise<void> {
        const query = this.query.some() ? this.query.unwrap().data : undefined;
        const positionalInput = query?.input?.some() ? query.input.unwrap() : "";
        const extractedTarget = BeatmapUtils.extractTarget(positionalInput);

        if (this.map.some() && extractedTarget.target !== undefined) {
            throw new Exception(EApplicationError.INPUT_ERROR, "The beatmap was specified more than once.");
        }

        const mapOption = this.map.some() ? this.map : new CommandOption<string>(extractedTarget.target ?? null);
        const resolved = await this.beatmapResolverService.resolveTargetWithVersion(
            ctx,
            mapOption,
            this.version,
            AdapterProvider.Bancho,
            "highest",
        );

        if (!resolved.beatmapID || !resolved.beatmapsetID) {
            throw new Exception(EApplicationError.NOT_FOUND, "Could not resolve beatmap or beatmapset.");
        }

        const beatmapset = await this.osuService.beatmapset(resolved.beatmapsetID, AdapterProvider.Bancho, true);

        if (!beatmapset?.beatmaps?.length) {
            throw new Exception(EApplicationError.NOT_FOUND, "Beatmapset not found or has no beatmaps.");
        }

        const parsedMods = this.mods.some()
            ? ModUtils.fromString(this.mods.unwrap().mods).filter((mod) => mod.acronym !== "DA")
            : [];

        const conflicts = ModUtils.findIncompatibilities(parsedMods);
        const conflict = Object.entries(conflicts)[0];

        if (conflict) {
            throw new Exception(
                EApplicationError.INPUT_ERROR,
                `${conflict[0]} is incompatible with ${conflict[1].join(", ")}.`,
            );
        }

        const data: SimulateViewDto = {
            timestamp: Date.now(),
            authorID: ctx.author.id,
            beatmapset,
            beatmapID: resolved.beatmapID,
            mods: parsedMods,
            scoringMode: ESimulateScoringMode.Lazer,
            attributes: {},
            statistics: {
                countMiss: 0,
            },
        };

        const parameters = SimulateParametersParser.parse(extractedTarget.remainder, query, resolved.beatmap.mode);
        SimulateParametersParser.apply(data, parameters, resolved.beatmap);

        await this.respondWithSession(ctx, "osu_simulate_view", data, this.simulateViewService);
    }
}
