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
    InjectMatch,
    IsMods,
    IsQuery,
    IsString,
    Option,
} from "@/core/decorators";
import { BeatmapResolverService } from "@/modules/osu/BeatmapResolver.service";
import { OsuService } from "@/modules/osu/Osu.service";
import { ScoreResolverService } from "@/modules/osu/ScoreResolver.service";
import { SimulateViewService } from "@/modules/osu/simulate/SimulateView.service";
import { CommandOption, ECommandCategory, ICommandMods, ICommandQueryData } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ResolvedBeatmapDto } from "@domain/osu/Beatmap.dto";
import { scoreUrlRegex } from "@domain/osu/configs/Score.config";
import { ESimulateScoringMode } from "@domain/osu/enums/Simulate.enum";
import { ScoreCalculationUtils } from "@domain/osu/utils/ScoreCalculationUtils";
import { SimulateViewDto } from "@domain/osu/views/Simulate.view";
import { ModDA, ModUtils } from "@generated/adapter/mods";
import { AdapterProvider, GameMode, Score } from "@generated/adapter/types";
import { SimulateParametersParser } from "@domain/osu/utils/SimulateParametersParser";
import { SimulateQueryDto } from "@domain/osu/Simulate.dto";
import { BeatmapUtils } from "@domain/osu/utils/BeatmapUtils";

@Help(`
    Simulates a score on a beatmap linked in the command or stored in the channel.
    A score URL can be used instead to populate the simulation with that score's
    mods, accuracy, combo, hit results, and scoring mode.

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
    "simulate https://osu.ppy.sh/scores/1234567890",
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
    @Import() declare private readonly scoreResolverService: ScoreResolverService;
    @Import() declare private readonly simulateViewService: SimulateViewService;

    @Option("score", "Specify an osu! score URL")
    @IsString()
    @InjectMatch((value) => scoreUrlRegex.test(value))
    declare private readonly score: CommandOption<string>;

    @Option("map", "Specify a map URL or ID")
    @IsString()
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
        const scoreID = this.score.some()
            ? await this.scoreResolverService.resolveCommandTarget(ctx, this.score)
            : undefined;

        if (scoreID && (this.map.some() || extractedTarget.target !== undefined)) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Specify either a score or a beatmap, not both.");
        }

        if (scoreID && this.version.some()) {
            throw new Exception(EApplicationError.INPUT_ERROR, "A difficulty cannot be specified with a score URL.");
        }

        if (this.map.some() && extractedTarget.target !== undefined) {
            throw new Exception(EApplicationError.INPUT_ERROR, "The beatmap was specified more than once.");
        }

        let baseScore: Score | undefined;
        let resolved: ResolvedBeatmapDto;

        if (scoreID) {
            baseScore = await this.osuService.score(scoreID, AdapterProvider.Bancho);
            const beatmap = baseScore.beatmap ?? (await this.osuService.beatmap(baseScore.beatmapID));

            if (!beatmap) {
                throw new Exception(EApplicationError.NOT_FOUND, "The score's beatmap could not be found.");
            }

            resolved = {
                beatmap,
                beatmapID: beatmap.id,
                beatmapsetID: beatmap.beatmapsetID,
            };
        } else {
            const mapOption = this.map.some() ? this.map : new CommandOption<string>(extractedTarget.target ?? null);
            resolved = await this.beatmapResolverService.resolveTargetWithVersion(
                ctx,
                mapOption,
                this.version,
                AdapterProvider.Bancho,
                "highest",
            );
        }

        if (!resolved.beatmapID || !resolved.beatmapsetID) {
            throw new Exception(EApplicationError.NOT_FOUND, "Could not resolve beatmap or beatmapset.");
        }

        const beatmapset = await this.osuService.beatmapset(resolved.beatmapsetID, AdapterProvider.Bancho, true);

        if (!beatmapset?.beatmaps?.length) {
            throw new Exception(EApplicationError.NOT_FOUND, "Beatmapset not found or has no beatmaps.");
        }

        const beatmap = beatmapset.beatmaps.find((candidate) => candidate.id === resolved.beatmapID);
        if (!beatmap) {
            throw new Exception(EApplicationError.NOT_FOUND, "The selected beatmap is unavailable.");
        }

        if (baseScore?.mode !== undefined) {
            beatmap.mode = baseScore.mode;
        }

        const explicitMods = this.mods.some()
            ? ModUtils.fromString(this.mods.unwrap().mods).filter((mod) => mod.acronym !== "DA")
            : undefined;

        const conflicts = ModUtils.findIncompatibilities(explicitMods ?? baseScore?.mods ?? []);
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
            mods: explicitMods ?? [],
            scoringMode: ESimulateScoringMode.Lazer,
            attributes: {},
            statistics: {
                countMiss: 0,
            },
        };

        if (baseScore) {
            this.applyScoreBase(data, baseScore, beatmap.mode);
        }

        if (explicitMods) {
            data.mods = explicitMods;
        }

        const parameters = SimulateParametersParser.parse(extractedTarget.remainder, query, beatmap.mode);
        SimulateParametersParser.apply(data, parameters, beatmap);

        await this.respondWithSession(ctx, "osu_simulate_view", data, this.simulateViewService);
    }

    private applyScoreBase(data: SimulateViewDto, score: Score, mode: GameMode): void {
        const stable = score.legacyTotalScore !== undefined;
        const statistics = score.statistics;
        const difficultyAdjust = score.mods.find((mod): mod is ModDA => mod.acronym === "DA");

        data.mods = score.mods.filter((mod) => mod.acronym !== "DA" && (!stable || mod.acronym !== "CL"));
        data.scoringMode = stable ? ESimulateScoringMode.Stable : ESimulateScoringMode.Lazer;
        data.accuracy = score.accuracy;
        data.combo = score.maxCombo;
        data.statistics = {
            count300: statistics.great,
            count100: statistics.ok,
            count50: statistics.meh,
            countGeki: statistics.perfect,
            countKatu: statistics.good,
            countMiss: statistics.miss,
        };

        if (stable) {
            data.legacyTotalScore = score.legacyTotalScore;
        } else if (mode === GameMode.Standard) {
            data.statistics.countLargeTickMisses = statistics.largeTickMiss;
            data.statistics.countSliderTailMisses = ScoreCalculationUtils.sliderTailMisses(score, mode);
        }

        if (difficultyAdjust?.settings) {
            data.attributes = {
                cs: difficultyAdjust.settings.circle_size,
                ar: difficultyAdjust.settings.approach_rate,
                od: difficultyAdjust.settings.overall_difficulty,
                hp: difficultyAdjust.settings.drain_rate,
            };
        }
    }
}
