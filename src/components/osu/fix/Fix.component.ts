import { AbstractSessionComponent } from "@/components/AbstractSessionComponent";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { Button, Import, Modal } from "@/core/decorators";
import { FixViewService } from "@/modules/osu/fix/FixView.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { FixViewDto } from "@domain/osu/views/Fix.view";
import { GameMode } from "@generated/adapter/types";
import { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";

type TFixAction = "accuracy" | "misses" | "combo" | "hits" | "reset";
type TFixModalAction = Exclude<TFixAction, "reset">;

abstract class AbstractFixComponent extends AbstractSessionComponent<"osu_fix_view", FixViewDto> {
    @Import() declare protected readonly fixViewService: FixViewService;

    protected readonly sessionKey = "osu_fix_view";
    protected readonly dto = FixViewDto;

    protected async getData(ctx: ComponentContext, sessionID: string): Promise<FixViewDto> {
        const data = await super.getData(ctx, sessionID);
        data.statistics ??= { countMiss: 0 };
        return data;
    }

    protected async persist(ctx: ComponentContext, sessionID: string, data: FixViewDto): Promise<void> {
        await ctx.deferUpdate();
        await this.session.update(this.sessionKey, sessionID, data, this.fixViewService.getTtl());
        await ctx.update(await this.fixViewService.build(sessionID, data));
    }
}

@Button(/^osu_fix:(?<action>accuracy|misses|combo|hits|reset):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class FixButtonComponent extends AbstractFixComponent {
    public async execute(ctx: ComponentContext): Promise<void> {
        const { action, sessionID } = ctx.params as { action?: TFixAction; sessionID?: string };
        if (!action || !sessionID) throw new Exception(EApplicationError.SESSION_EXPIRED);

        const data = await this.getData(ctx, sessionID);

        if (action !== "reset") {
            await ctx.showModal(FixModalFactory.create(action, sessionID, data));
            return;
        }

        data.accuracy = data.proposedAccuracy;
        data.combo = undefined;
        data.statistics = { countMiss: 0 };
        await this.persist(ctx, sessionID, data);
    }
}

@Modal(/^osu_fix_modal:(?<action>accuracy|misses|combo|hits):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class FixModalComponent extends AbstractFixComponent {
    public async execute(ctx: ComponentContext): Promise<void> {
        const { action, sessionID } = ctx.params as { action?: TFixModalAction; sessionID?: string };
        if (!action || !sessionID) throw new Exception(EApplicationError.SESSION_EXPIRED);

        const data = await this.getData(ctx, sessionID);
        const mode = data.sourceScore.mode ?? data.profile.mode;

        switch (action) {
            case "accuracy":
                this.applyAccuracy(ctx, data, mode);
                break;
            case "misses":
                this.applyMisses(ctx, data, mode);
                break;
            case "combo":
                data.combo = this.optionalInteger(ctx, "combo", 0, data.sourceScore.fullDifficulty.maxCombo);
                break;
            case "hits":
                this.applyHits(ctx, data, mode);
                break;
        }

        await this.persist(ctx, sessionID, data);
    }

    private applyAccuracy(ctx: ComponentContext, data: FixViewDto, mode: GameMode): void {
        const accuracy = this.optionalNumber(ctx, "accuracy", 0, 100);
        data.accuracy = accuracy === undefined ? data.proposedAccuracy : accuracy / 100;
        this.clearHitCounts(data, mode);
    }

    private applyMisses(ctx: ComponentContext, data: FixViewDto, mode: GameMode): void {
        data.statistics.countMiss = this.optionalInteger(ctx, "countMiss", 0, 999_999) ?? 0;

        if (mode === GameMode.Catch) {
            data.statistics.countKatu = this.optionalInteger(ctx, "countTinyMiss", 0, 999_999);
        }
    }

    private applyHits(ctx: ComponentContext, data: FixViewDto, mode: GameMode): void {
        this.clearHitCounts(data, mode);

        switch (mode) {
            case GameMode.Standard:
                data.statistics.count300 = this.optionalInteger(ctx, "count300", 0, 999_999);
                data.statistics.count100 = this.optionalInteger(ctx, "count100", 0, 999_999);
                data.statistics.count50 = this.optionalInteger(ctx, "count50", 0, 999_999);
                break;
            case GameMode.Taiko:
                data.statistics.count300 = this.optionalInteger(ctx, "count300", 0, 999_999);
                data.statistics.count100 = this.optionalInteger(ctx, "count100", 0, 999_999);
                break;
            case GameMode.Catch:
                data.statistics.count300 = this.optionalInteger(ctx, "count300", 0, 999_999);
                data.statistics.count100 = this.optionalInteger(ctx, "count100", 0, 999_999);
                data.statistics.count50 = this.optionalInteger(ctx, "count50", 0, 999_999);
                break;
            case GameMode.Mania:
                data.statistics.countGeki = this.optionalInteger(ctx, "countGeki", 0, 999_999);
                data.statistics.count300 = this.optionalInteger(ctx, "count300", 0, 999_999);
                data.statistics.countKatu = this.optionalInteger(ctx, "countKatu", 0, 999_999);
                data.statistics.count100 = this.optionalInteger(ctx, "count100", 0, 999_999);
                data.statistics.count50 = this.optionalInteger(ctx, "count50", 0, 999_999);
                break;
        }

        data.accuracy = this.hasHitCounts(data, mode) ? undefined : data.proposedAccuracy;
    }

    private clearHitCounts(data: FixViewDto, mode: GameMode): void {
        data.statistics.countGeki = undefined;
        data.statistics.count300 = undefined;
        data.statistics.count100 = undefined;
        data.statistics.count50 = undefined;

        if (mode !== GameMode.Catch) {
            data.statistics.countKatu = undefined;
        }
    }

    private hasHitCounts(data: FixViewDto, mode: GameMode): boolean {
        const statistics = data.statistics;

        if (mode === GameMode.Mania) {
            return [
                statistics.countGeki,
                statistics.count300,
                statistics.countKatu,
                statistics.count100,
                statistics.count50,
            ].some((value) => value !== undefined);
        }

        return [statistics.count300, statistics.count100, statistics.count50].some((value) => value !== undefined);
    }

    private optionalNumber(ctx: ComponentContext, id: string, min: number, max: number): number | undefined {
        const raw = (ctx.getTextInput(id) ?? "").trim();
        if (!raw) return undefined;

        const value = Number(raw);
        if (!Number.isFinite(value) || value < min || value > max) {
            throw new Exception(EApplicationError.INPUT_ERROR, `${id} must be between ${min} and ${max}.`);
        }

        return value;
    }

    private optionalInteger(ctx: ComponentContext, id: string, min: number, max: number): number | undefined {
        const value = this.optionalNumber(ctx, id, min, max);
        if (value !== undefined && !Number.isSafeInteger(value)) {
            throw new Exception(EApplicationError.INPUT_ERROR, `${id} must be a whole number.`);
        }

        return value;
    }
}

class FixModalFactory {
    public static create(action: TFixModalAction, sessionID: string, data: FixViewDto): ModalBuilder {
        const mode = data.sourceScore.mode ?? data.profile.mode;
        const modal = new ModalBuilder().setCustomId(`osu_fix_modal:${action}:${sessionID}`);

        switch (action) {
            case "accuracy":
                modal.setTitle("Fixed Accuracy");
                this.addInput(
                    modal,
                    "accuracy",
                    "Accuracy (%)",
                    data.accuracy === undefined ? undefined : (data.accuracy * 100).toFixed(2),
                    `Proposed: ${(data.proposedAccuracy * 100).toFixed(2)}%`,
                );
                break;
            case "misses":
                modal.setTitle("Fixed Miss Count");
                this.addInput(
                    modal,
                    "countMiss",
                    mode === GameMode.Catch ? "Fruit / Droplet Misses" : "Misses",
                    data.statistics.countMiss ?? 0,
                    "0",
                );

                if (mode === GameMode.Catch) {
                    this.addInput(modal, "countTinyMiss", "Tiny Droplet Misses", data.statistics.countKatu, "0");
                }
                break;
            case "combo":
                modal.setTitle("Fixed Combo");
                this.addInput(
                    modal,
                    "combo",
                    "Combo",
                    data.combo,
                    `Maximum: ${data.sourceScore.fullDifficulty.maxCombo}x`,
                );
                break;
            case "hits":
                modal.setTitle("Fixed Hit Counts");
                this.addHitInputs(modal, data, mode);
                break;
        }

        return modal;
    }

    private static addHitInputs(modal: ModalBuilder, data: FixViewDto, mode: GameMode): void {
        switch (mode) {
            case GameMode.Standard:
                this.addInput(modal, "count300", "300s", data.statistics.count300, "Automatic");
                this.addInput(modal, "count100", "100s", data.statistics.count100, "Automatic");
                this.addInput(modal, "count50", "50s", data.statistics.count50, "Automatic");
                break;
            case GameMode.Taiko:
                this.addInput(modal, "count300", "Greats", data.statistics.count300, "Automatic");
                this.addInput(modal, "count100", "Goods", data.statistics.count100, "Automatic");
                break;
            case GameMode.Catch:
                this.addInput(modal, "count300", "Fruits", data.statistics.count300, "Automatic");
                this.addInput(modal, "count100", "Droplets", data.statistics.count100, "Automatic");
                this.addInput(modal, "count50", "Tiny Droplet Hits", data.statistics.count50, "Automatic");
                break;
            case GameMode.Mania:
                this.addInput(modal, "countGeki", "Perfects", data.statistics.countGeki, "Automatic");
                this.addInput(modal, "count300", "Greats", data.statistics.count300, "Automatic");
                this.addInput(modal, "countKatu", "Goods", data.statistics.countKatu, "Automatic");
                this.addInput(modal, "count100", "Oks", data.statistics.count100, "Automatic");
                this.addInput(modal, "count50", "Mehs", data.statistics.count50, "Automatic");
                break;
        }
    }

    private static addInput(
        modal: ModalBuilder,
        id: string,
        label: string,
        value?: string | number,
        placeholder?: string,
    ): void {
        const input = new TextInputBuilder()
            .setCustomId(id)
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(12);

        if (value !== undefined) input.setValue(String(value));
        if (placeholder) input.setPlaceholder(placeholder);

        modal.addLabelComponents(new LabelBuilder().setLabel(label).setTextInputComponent(input));
    }
}
