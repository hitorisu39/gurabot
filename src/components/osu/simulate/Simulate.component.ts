import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { Button, Import, Modal } from "@/core/decorators";
import { SimulateViewService } from "@/modules/osu/simulate/SimulateView.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ESimulateScoringMode } from "@domain/osu/enums/Simulate.enum";
import { SimulateScoreUtils } from "@domain/osu/utils/SimulateScoreUtils";
import { SimulateViewDto } from "@domain/osu/views/Simulate.view";
import { ModUtils } from "@generated/adapter/mods";
import { Beatmap, GameMode } from "@generated/adapter/types";
import { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { isValidNumber } from "@domain/utils/utils";
import { AbstractSessionComponent } from "@/components/AbstractSessionComponent";

type TSimulateAction =
    | "mods"
    | "accuracy"
    | "combo"
    | "rate"
    | "attributes"
    | "hits"
    | "misses"
    | "slider_ends"
    | "large_ticks"
    | "score"
    | "scoring";

type TSimulateModalAction = Exclude<TSimulateAction, "scoring">;

abstract class AbstractSimulateComponent extends AbstractSessionComponent<"osu_simulate_view", SimulateViewDto> {
    @Import() declare protected readonly simulateViewService: SimulateViewService;

    protected readonly sessionKey = "osu_simulate_view";
    protected readonly dto = SimulateViewDto;

    protected async getData(ctx: ComponentContext, sessionID: string): Promise<SimulateViewDto> {
        const data = await super.getData(ctx, sessionID);

        data.attributes ??= {};
        data.statistics ??= {};

        return data;
    }

    protected getMap(data: SimulateViewDto): Beatmap {
        const map = data.beatmapset.beatmaps?.find((candidate) => candidate.id === data.beatmapID);
        if (!map) {
            throw new Exception(EApplicationError.NOT_FOUND, "Beatmap not found.");
        }

        return map;
    }

    protected async persist(ctx: ComponentContext, sessionID: string, data: SimulateViewDto): Promise<void> {
        await ctx.deferUpdate();
        await this.session.update(this.sessionKey, sessionID, data, this.simulateViewService.getTtl());
        const payload = await this.simulateViewService.build(sessionID, data);
        await ctx.update(payload);
    }
}

@Button(
    /^osu_simulate_(?<action>mods|accuracy|combo|rate|attributes|hits|misses|slider_ends|large_ticks|score|scoring):(?<sessionID>[a-zA-Z0-9_-]+)$/,
)
export class SimulateButtonComponent extends AbstractSimulateComponent {
    public async execute(ctx: ComponentContext): Promise<void> {
        const { action, sessionID } = ctx.params as {
            action?: TSimulateAction;
            sessionID?: string;
        };

        if (!sessionID || !action) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = await this.getData(ctx, sessionID);

        if (action !== "scoring") {
            const modal = SimulateModalFactory.create(action, sessionID, data);
            await ctx.showModal(modal);
            return;
        }

        data.scoringMode =
            data.scoringMode === ESimulateScoringMode.Lazer ? ESimulateScoringMode.Stable : ESimulateScoringMode.Lazer;

        if (data.scoringMode === ESimulateScoringMode.Stable) {
            data.statistics.countLargeTickMisses = undefined;
            data.statistics.countSliderTailMisses = undefined;
        } else {
            data.legacyTotalScore = undefined;
        }

        await this.persist(ctx, sessionID, data);
    }
}

@Modal(
    /^osu_simulate_modal_(?<action>mods|accuracy|combo|rate|attributes|hits|misses|slider_ends|large_ticks|score):(?<sessionID>[a-zA-Z0-9_-]+)$/,
)
export class SimulateModalComponent extends AbstractSimulateComponent {
    public async execute(ctx: ComponentContext): Promise<void> {
        const { action, sessionID } = ctx.params as {
            action?: TSimulateModalAction;
            sessionID?: string;
        };

        if (!sessionID || !action) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = await this.getData(ctx, sessionID);
        const map = this.getMap(data);

        switch (action) {
            case "mods":
                this.applyMods(ctx, data);
                break;
            case "accuracy":
                this.applyAccuracy(ctx, data);
                break;
            case "combo":
                data.combo = this.optionalInteger(ctx, "combo", 0, 999_999);
                break;
            case "rate":
                this.applyRate(ctx, data, map);
                break;
            case "attributes":
                this.applyAttributes(ctx, data, map.mode);
                break;
            case "hits":
                this.applyHits(ctx, data, map.mode);
                break;
            case "misses":
                this.applyMisses(ctx, data, map.mode);
                break;
            case "slider_ends":
                data.statistics.countSliderTailMisses = this.optionalInteger(ctx, "slider_tail_misses", 0, 999_999);
                break;
            case "large_ticks":
                data.statistics.countLargeTickMisses = this.optionalInteger(ctx, "large_tick_misses", 0, 999_999);
                break;
            case "score":
                if (data.scoringMode !== ESimulateScoringMode.Stable) {
                    throw new Exception(EApplicationError.INPUT_ERROR, "Score input is only available in Stable mode.");
                }

                data.legacyTotalScore = this.optionalInteger(ctx, "legacy_total_score", 0, 4_294_967_295);
                break;
        }

        await this.persist(ctx, sessionID, data);
    }

    private applyMods(ctx: ComponentContext, data: SimulateViewDto): void {
        const raw = (ctx.getTextInput("mods") ?? "").trim().toUpperCase();

        if (!raw || raw === "NM") {
            data.mods = [];
            return;
        }

        const compact = raw.replace(/[\s,+]/g, "");
        const tokens = compact.match(/10K|[A-Z0-9]{2}/g) ?? [];

        if (!tokens.length || tokens.join("") !== compact) {
            throw new Exception(
                EApplicationError.INPUT_ERROR,
                "Invalid mod string. Use compact acronyms such as HDDT.",
            );
        }

        const uniqueTokens = [...new Set(tokens)];

        let mods = ModUtils.parse(uniqueTokens).filter((mod) => mod.acronym !== "DA");

        const unknown = mods.find((mod) => mod.type === "Unknown");
        if (unknown) {
            throw new Exception(EApplicationError.INPUT_ERROR, `Unknown mod acronym: ${unknown.acronym}.`);
        }

        if (SimulateScoreUtils.hasAttributeOverrides(data)) {
            mods = mods.filter((mod) => mod.acronym !== "EZ" && mod.acronym !== "HR");
        }

        const conflicts = ModUtils.findIncompatibilities(mods);
        const conflict = Object.entries(conflicts)[0];

        if (conflict) {
            throw new Exception(
                EApplicationError.INPUT_ERROR,
                `${conflict[0]} is incompatible with ${conflict[1].join(", ")}.`,
            );
        }

        data.mods = mods;
    }

    private applyAccuracy(ctx: ComponentContext, data: SimulateViewDto): void {
        const accuracy = this.optionalNumber(ctx, "accuracy", 0, 100);
        data.accuracy = accuracy === undefined ? undefined : accuracy / 100;

        if (accuracy !== undefined) {
            SimulateScoreUtils.clearManualHitCounts(data);
        }
    }

    private applyRate(ctx: ComponentContext, data: SimulateViewDto, map: Beatmap): void {
        const bpm = this.optionalNumber(ctx, "bpm", 1, 99_999);
        const clockRate = this.optionalNumber(ctx, "clock_rate", 0.5, 2);

        if (bpm !== undefined && clockRate !== undefined) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Specify either BPM or clock rate, not both.");
        }

        if (bpm === undefined && clockRate === undefined) {
            data.clockRate = undefined;
            return;
        }

        const resolvedRate = clockRate ?? bpm! / map.bpm;

        if (resolvedRate < 0.5 || resolvedRate > 2) {
            throw new Exception(
                EApplicationError.INPUT_ERROR,
                "The resulting clock rate must be between 0.50x and 2.00x.",
            );
        }

        data.clockRate = resolvedRate;
    }

    private applyAttributes(ctx: ComponentContext, data: SimulateViewDto, mode: GameMode): void {
        if (mode === GameMode.Standard || mode === GameMode.Catch) {
            data.attributes.cs = this.optionalNumber(ctx, "cs", 0, 11);
            data.attributes.ar = this.optionalNumber(ctx, "ar", 0, 11);
        } else {
            data.attributes.cs = undefined;
            data.attributes.ar = undefined;
        }

        data.attributes.od = this.optionalNumber(ctx, "od", 0, 11);
        data.attributes.hp = this.optionalNumber(ctx, "hp", 0, 11);

        if (SimulateScoreUtils.hasAttributeOverrides(data)) {
            data.mods = data.mods.filter((mod) => mod.acronym !== "EZ" && mod.acronym !== "HR");
        }
    }

    private applyHits(ctx: ComponentContext, data: SimulateViewDto, mode: GameMode): void {
        const values: Array<number | undefined> = [];

        switch (mode) {
            case GameMode.Standard:
                data.statistics.count300 = this.optionalInteger(ctx, "count300", 0, 999_999);
                data.statistics.count100 = this.optionalInteger(ctx, "count100", 0, 999_999);
                data.statistics.count50 = this.optionalInteger(ctx, "count50", 0, 999_999);
                values.push(data.statistics.count300, data.statistics.count100, data.statistics.count50);
                break;
            case GameMode.Taiko:
                data.statistics.count300 = this.optionalInteger(ctx, "count300", 0, 999_999);
                data.statistics.count100 = this.optionalInteger(ctx, "count100", 0, 999_999);
                values.push(data.statistics.count300, data.statistics.count100);
                break;
            case GameMode.Catch:
                data.statistics.count300 = this.optionalInteger(ctx, "count300", 0, 999_999);
                data.statistics.count100 = this.optionalInteger(ctx, "count100", 0, 999_999);
                data.statistics.count50 = this.optionalInteger(ctx, "count50", 0, 999_999);
                values.push(data.statistics.count300, data.statistics.count100, data.statistics.count50);
                break;
            case GameMode.Mania:
                data.statistics.countGeki = this.optionalInteger(ctx, "countGeki", 0, 999_999);
                data.statistics.count300 = this.optionalInteger(ctx, "count300", 0, 999_999);
                data.statistics.countKatu = this.optionalInteger(ctx, "countKatu", 0, 999_999);
                data.statistics.count100 = this.optionalInteger(ctx, "count100", 0, 999_999);
                data.statistics.count50 = this.optionalInteger(ctx, "count50", 0, 999_999);
                values.push(
                    data.statistics.countGeki,
                    data.statistics.count300,
                    data.statistics.countKatu,
                    data.statistics.count100,
                    data.statistics.count50,
                );
                break;
        }

        const supplied = values.filter((value) => value !== undefined).length;

        if (supplied > 0) {
            data.accuracy = undefined;
        }
    }

    private applyMisses(ctx: ComponentContext, data: SimulateViewDto, mode: GameMode): void {
        data.statistics.countMiss = this.optionalInteger(ctx, "countMiss", 0, 999_999);
        if (mode === GameMode.Catch) {
            data.statistics.countKatu = this.optionalInteger(ctx, "countTinyMiss", 0, 999_999);
        }
    }

    private optionalNumber(ctx: ComponentContext, id: string, min: number, max: number): number | undefined {
        const raw = (ctx.getTextInput(id) ?? "").trim();
        if (!raw) {
            return undefined;
        }

        const value = Number(raw);
        if (!isValidNumber(value) || value < min || value > max) {
            throw new Exception(EApplicationError.INPUT_ERROR, `${id} must be a number between ${min} and ${max}.`);
        }

        return value;
    }

    private optionalInteger(ctx: ComponentContext, id: string, min: number, max: number): number | undefined {
        const value = this.optionalNumber(ctx, id, min, max);
        if (value !== undefined && !Number.isInteger(value)) {
            throw new Exception(EApplicationError.INPUT_ERROR, `${id} must be a whole number.`);
        }

        return value;
    }
}

class SimulateModalFactory {
    public static create(
        action: Exclude<TSimulateAction, "scoring">,
        sessionID: string,
        data: SimulateViewDto,
    ): ModalBuilder {
        const map = data.beatmapset.beatmaps?.find((candidate) => candidate.id === data.beatmapID);
        if (!map) {
            throw new Exception(EApplicationError.NOT_FOUND, "Beatmap not found.");
        }

        const modal = new ModalBuilder().setCustomId(`osu_simulate_modal_${action}:${sessionID}`);

        switch (action) {
            case "mods":
                modal.setTitle("Simulation Mods");
                this.addInput(
                    modal,
                    "mods",
                    "Mods",
                    data.mods.map((mod) => mod.acronym).join(""),
                    "HDDT, HR, 4K, or NM",
                    40,
                );
                break;
            case "accuracy":
                modal.setTitle("Simulation Accuracy");
                this.addInput(
                    modal,
                    "accuracy",
                    "Accuracy (%)",
                    data.accuracy !== undefined ? (data.accuracy * 100).toFixed(2) : undefined,
                    "98.50 — leave empty for automatic",
                    8,
                );
                break;
            case "combo":
                modal.setTitle("Simulation Combo");
                this.addInput(modal, "combo", "Combo", data.combo, "Leave empty for maximum combo", 10);
                break;
            case "rate":
                modal.setTitle("Simulation BPM / Rate");
                this.addInput(modal, "bpm", "Target BPM", undefined, "Specify BPM, or use clock rate below", 12);
                this.addInput(
                    modal,
                    "clock_rate",
                    "Clock Rate",
                    data.clockRate,
                    "0.50-2.00; leave both empty to reset",
                    8,
                );
                break;
            case "attributes":
                modal.setTitle("Difficulty Attributes");

                if (map.mode === GameMode.Standard || map.mode === GameMode.Catch) {
                    this.addInput(modal, "cs", "CS", data.attributes.cs, "0-11", 6);
                    this.addInput(modal, "ar", "AR", data.attributes.ar, "0-11", 6);
                }

                this.addInput(modal, "od", "OD", data.attributes.od, "0-11", 6);
                this.addInput(modal, "hp", "HP", data.attributes.hp, "0-11", 6);
                break;
            case "hits":
                modal.setTitle("Hit Counts");
                this.addHitInputs(modal, data, map.mode);
                break;
            case "misses":
                modal.setTitle("Miss Counts");
                this.addInput(
                    modal,
                    "countMiss",
                    map.mode === GameMode.Catch ? "Fruit / Droplet Misses" : "Misses",
                    data.statistics.countMiss,
                    "0",
                    10,
                );

                if (map.mode === GameMode.Catch) {
                    this.addInput(modal, "countTinyMiss", "Tiny Droplet Misses", data.statistics.countKatu, "0", 10);
                }
                break;

            case "slider_ends":
                modal.setTitle("Slider End Misses");
                this.addInput(
                    modal,
                    "slider_tail_misses",
                    "Missed Slider Ends",
                    data.statistics.countSliderTailMisses,
                    "Leave empty for automatic",
                    10,
                );
                break;

            case "large_ticks":
                modal.setTitle("Large Tick Misses");
                this.addInput(
                    modal,
                    "large_tick_misses",
                    "Missed Large Ticks",
                    data.statistics.countLargeTickMisses,
                    "Leave empty for automatic",
                    10,
                );
                break;

            case "score":
                modal.setTitle("Stable Score");
                this.addInput(
                    modal,
                    "legacy_total_score",
                    "Stable Total Score",
                    data.legacyTotalScore,
                    "Leave empty for automatic",
                    12,
                );
                break;
        }

        return modal;
    }

    private static addHitInputs(modal: ModalBuilder, data: SimulateViewDto, mode: GameMode): void {
        switch (mode) {
            case GameMode.Standard:
                this.addInput(modal, "count300", "300s", data.statistics.count300, "0", 10);
                this.addInput(modal, "count100", "100s", data.statistics.count100, "0", 10);
                this.addInput(modal, "count50", "50s", data.statistics.count50, "0", 10);
                break;
            case GameMode.Taiko:
                this.addInput(modal, "count300", "Greats", data.statistics.count300, "0", 10);
                this.addInput(modal, "count100", "Goods", data.statistics.count100, "0", 10);
                break;
            case GameMode.Catch:
                this.addInput(modal, "count300", "Fruits", data.statistics.count300, "0", 10);
                this.addInput(modal, "count100", "Droplets", data.statistics.count100, "0", 10);
                this.addInput(modal, "count50", "Tiny Droplet Hits", data.statistics.count50, "0", 10);
                break;
            case GameMode.Mania:
                this.addInput(modal, "countGeki", "Perfects", data.statistics.countGeki, "0", 10);
                this.addInput(modal, "count300", "Greats", data.statistics.count300, "0", 10);
                this.addInput(modal, "countKatu", "Goods", data.statistics.countKatu, "0", 10);
                this.addInput(modal, "count100", "Oks", data.statistics.count100, "0", 10);
                this.addInput(modal, "count50", "Mehs", data.statistics.count50, "0", 10);
                break;
        }
    }

    private static addInput(
        modal: ModalBuilder,
        id: string,
        label: string,
        value?: string | number,
        placeholder?: string,
        maxLength: number = 20,
    ): void {
        const input = new TextInputBuilder()
            .setCustomId(id)
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(maxLength);

        if (value !== undefined) input.setValue(String(value));
        if (placeholder) input.setPlaceholder(placeholder);

        modal.addLabelComponents(new LabelBuilder().setLabel(label).setTextInputComponent(input));
    }
}
