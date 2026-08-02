import { AbstractComponent } from "@/core/discord/AbstractComponent";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { Button, Import, Modal, SelectMenu } from "@/core/decorators";
import { SessionService } from "@/modules/cache/Session.service";
import { OrdrService } from "@/modules/ordr/Ordr.service";
import { OrdrConfigService } from "@/modules/ordr/OrdrConfig.service";
import { OrdrConfigViewService } from "@/modules/ordr/OrdrConfigView.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { EOrdrConfigSource, EOrdrResolution, OrdrConfigDto, OrdrSettingsDto } from "@domain/ordr/OrdrConfig.dto";
import { EOrdrConfigView, OrdrConfigViewDto } from "@domain/ordr/views/OrdrConfig.view";
import { plainToInstance } from "class-transformer";
import { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";

type TBooleanKeys<T> = {
    [K in keyof T]-?: T[K] extends boolean ? K : never;
}[keyof T];

const booleanSettings = [
    "customSkin",
    "skip",
    "showResultScreen",
    "useSkinHitsounds",
    "playNightcoreSamples",
    "showHitErrorMeter",
    "showUnstableRate",
    "showScore",
    "showHPBar",
    "showComboCounter",
    "showPPCounter",
    "showScoreboard",
    "showAvatarsOnScoreboard",
    "showBorders",
    "showMods",
    "showAimErrorMeter",
    "showHitCounter",
    "showKeyOverlay",
    "showStrainGraph",
    "showSliderBreaks",
    "useSkinCursor",
    "useSkinColors",
    "useBeatmapColors",
    "cursorTrail",
    "sliderSnakingIn",
    "sliderSnakingOut",
    "ignoreFail",
    "loadStoryboard",
    "loadVideo",
    "showDanserLogo",
] as const satisfies ReadonlyArray<TBooleanKeys<OrdrSettingsDto>>;

type TOrdrBooleanSetting = (typeof booleanSettings)[number];

type TOrdrConfigAction =
    | "source_bot"
    | "source_preset"
    | "refresh"
    | "resolution"
    | "skin"
    | "audio"
    | "cursor"
    | "background"
    | "save"
    | "discard"
    | "reset";

type TOrdrConfigModal = "skin" | "audio" | "cursor" | "background";

const settingViews: Record<TOrdrBooleanSetting, EOrdrConfigView> = {
    customSkin: EOrdrConfigView.Output,
    skip: EOrdrConfigView.Output,
    showResultScreen: EOrdrConfigView.Output,

    useSkinHitsounds: EOrdrConfigView.Audio,
    playNightcoreSamples: EOrdrConfigView.Audio,

    showHitErrorMeter: EOrdrConfigView.HUD,
    showUnstableRate: EOrdrConfigView.HUD,
    showScore: EOrdrConfigView.HUD,
    showHPBar: EOrdrConfigView.HUD,
    showComboCounter: EOrdrConfigView.HUD,
    showPPCounter: EOrdrConfigView.HUD,
    showScoreboard: EOrdrConfigView.HUD,
    showAvatarsOnScoreboard: EOrdrConfigView.HUD,
    showBorders: EOrdrConfigView.HUD,
    showMods: EOrdrConfigView.HUD,
    showAimErrorMeter: EOrdrConfigView.HUD,
    showHitCounter: EOrdrConfigView.HUD,
    showKeyOverlay: EOrdrConfigView.HUD,
    showStrainGraph: EOrdrConfigView.HUD,
    showSliderBreaks: EOrdrConfigView.HUD,

    useSkinCursor: EOrdrConfigView.Gameplay,
    useSkinColors: EOrdrConfigView.Gameplay,
    useBeatmapColors: EOrdrConfigView.Gameplay,
    cursorTrail: EOrdrConfigView.Gameplay,
    sliderSnakingIn: EOrdrConfigView.Gameplay,
    sliderSnakingOut: EOrdrConfigView.Gameplay,
    ignoreFail: EOrdrConfigView.Gameplay,

    loadStoryboard: EOrdrConfigView.Background,
    loadVideo: EOrdrConfigView.Background,
    showDanserLogo: EOrdrConfigView.Background,
};

@SelectMenu(/^ordr_config_page:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OrdrConfigPageComponent extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly ordrConfigViewService: OrdrConfigViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const sessionID = ctx.params.sessionID;
        if (!sessionID) throw new Exception(EApplicationError.SESSION_EXPIRED);

        const data = await this.getData(ctx, sessionID);
        const view = ctx.values[0] as EOrdrConfigView | undefined;

        if (!view || !Object.values(EOrdrConfigView).includes(view)) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Unknown configuration page.");
        }

        data.view = view;

        await ctx.deferUpdate();
        await this.persist(ctx, sessionID, data);
    }

    private async getData(ctx: ComponentContext, sessionID: string): Promise<OrdrConfigViewDto> {
        const plain = await this.sessionService.get("ordr_config_view", sessionID);
        if (!plain) throw new Exception(EApplicationError.SESSION_EXPIRED);

        const data = plainToInstance(OrdrConfigViewDto, plain);
        if (data.authorID !== ctx.author.id) throw new Exception(EApplicationError.ACCESS_ERROR);

        return data;
    }

    private async persist(ctx: ComponentContext, sessionID: string, data: OrdrConfigViewDto): Promise<void> {
        await this.sessionService.update("ordr_config_view", sessionID, data, this.ordrConfigViewService.getTtl());
        await ctx.update(this.ordrConfigViewService.build(sessionID, data));
    }
}

@Button(
    /^ordr_config_action:(?<action>source_bot|source_preset|refresh|resolution|skin|audio|cursor|background|save|discard|reset):(?<sessionID>[a-zA-Z0-9_-]+)$/,
)
export class OrdrConfigActionComponent extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly ordrService: OrdrService;
    @Import() declare private readonly ordrConfigService: OrdrConfigService;
    @Import() declare private readonly ordrConfigViewService: OrdrConfigViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { action, sessionID } = ctx.params as {
            action?: TOrdrConfigAction;
            sessionID?: string;
        };

        if (!action || !sessionID) throw new Exception(EApplicationError.SESSION_EXPIRED);

        const data = await this.getData(ctx, sessionID);

        if (action === "skin" || action === "audio" || action === "cursor" || action === "background") {
            this.requireBotSettings(data);

            return await ctx.showModal(OrdrConfigModalFactory.create(action, sessionID, data.draft.settings));
        }

        switch (action) {
            case "source_bot":
                data.draft.source = EOrdrConfigSource.Bot;
                data.view = EOrdrConfigView.Overview;
                break;

            case "source_preset":
                if (!data.preset) {
                    throw new Exception(EApplicationError.INPUT_ERROR, "No bot-enabled issou.best preset was found.");
                }

                data.draft.source = EOrdrConfigSource.Preset;
                data.view = EOrdrConfigView.Overview;
                break;

            case "refresh":
                await ctx.deferUpdate();

                data.preset = await this.ordrService.preset(ctx.author.id);

                if (!data.preset && data.draft.source === EOrdrConfigSource.Preset) {
                    data.draft.source = EOrdrConfigSource.Bot;
                }

                data.view = EOrdrConfigView.Overview;
                return await this.persist(ctx, sessionID, data);

            case "resolution":
                this.requireBotSettings(data);

                data.draft.settings.resolution =
                    data.draft.settings.resolution === EOrdrResolution.HD ? EOrdrResolution.SD : EOrdrResolution.HD;

                data.view = EOrdrConfigView.Output;
                break;

            case "reset":
                data.draft.source = EOrdrConfigSource.Bot;
                data.draft.settings = this.ordrConfigService.defaults();
                data.view = EOrdrConfigView.Overview;
                break;

            case "discard":
                data.draft = this.clone(data.original);
                data.view = EOrdrConfigView.Overview;
                break;

            case "save": {
                this.validateDraft(data);

                const saved = await this.ordrConfigService.save(ctx.author.id, data.draft.source, data.draft.settings);

                data.original = this.clone(saved);
                data.draft = this.clone(saved);
                data.view = EOrdrConfigView.Overview;
                break;
            }
        }

        await ctx.deferUpdate();
        await this.persist(ctx, sessionID, data);
    }

    private validateDraft(data: OrdrConfigViewDto): void {
        if (data.draft.source === EOrdrConfigSource.Preset) {
            if (!data.preset) {
                throw new Exception(EApplicationError.INPUT_ERROR, "Your issou.best preset is no longer available.");
            }

            return;
        }

        const settings = data.draft.settings;

        if (!settings.skin.trim()) {
            throw new Exception(EApplicationError.INPUT_ERROR, "A render skin must be specified.");
        }

        if (!Object.values(EOrdrResolution).includes(settings.resolution)) {
            throw new Exception(EApplicationError.INPUT_ERROR, "The resolution must be 960x540 or 1280x720.");
        }

        this.assertIntegerRange("Global volume", settings.globalVolume, 0, 100);
        this.assertIntegerRange("Music volume", settings.musicVolume, 0, 100);
        this.assertIntegerRange("Hitsound volume", settings.hitsoundVolume, 0, 100);
        this.assertIntegerRange("Intro dim", settings.introBGDim, 0, 100);
        this.assertIntegerRange("Gameplay dim", settings.inGameBGDim, 0, 100);
        this.assertIntegerRange("Break dim", settings.breakBGDim, 0, 100);

        if (!Number.isFinite(settings.cursorSize) || settings.cursorSize < 0.5 || settings.cursorSize > 2) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Cursor size must be between 0.50 and 2.00.");
        }

        if (settings.customSkin) {
            const customSkinID = Number(settings.skin);

            if (!Number.isInteger(customSkinID) || customSkinID <= 0) {
                throw new Exception(
                    EApplicationError.INPUT_ERROR,
                    "A custom skin must use a positive numeric skin ID.",
                );
            }
        }

        if (!settings.showHitErrorMeter) settings.showUnstableRate = false;
        if (!settings.showScoreboard) settings.showAvatarsOnScoreboard = false;
        if (!settings.showHitCounter) settings.showSliderBreaks = false;
        if (!settings.loadStoryboard) settings.loadVideo = false;
    }

    private assertIntegerRange(name: string, value: number, min: number, max: number): void {
        if (!Number.isInteger(value) || value < min || value > max) {
            throw new Exception(
                EApplicationError.INPUT_ERROR,
                `${name} must be a whole number between ${min} and ${max}.`,
            );
        }
    }

    private requireBotSettings(data: OrdrConfigViewDto): void {
        if (data.draft.source === EOrdrConfigSource.Preset) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Switch to bot-managed settings before editing.");
        }
    }

    private clone(config: OrdrConfigDto): OrdrConfigDto {
        return plainToInstance(OrdrConfigDto, structuredClone(config));
    }

    private async getData(ctx: ComponentContext, sessionID: string): Promise<OrdrConfigViewDto> {
        const plain = await this.sessionService.get("ordr_config_view", sessionID);
        if (!plain) throw new Exception(EApplicationError.SESSION_EXPIRED);

        const data = plainToInstance(OrdrConfigViewDto, plain);
        if (data.authorID !== ctx.author.id) throw new Exception(EApplicationError.ACCESS_ERROR);

        return data;
    }

    private async persist(ctx: ComponentContext, sessionID: string, data: OrdrConfigViewDto): Promise<void> {
        await this.sessionService.update("ordr_config_view", sessionID, data, this.ordrConfigViewService.getTtl());
        await ctx.update(this.ordrConfigViewService.build(sessionID, data));
    }
}

@Button(/^ordr_config_toggle:(?<setting>[a-zA-Z]+):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OrdrConfigToggleComponent extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly ordrConfigService: OrdrConfigService;
    @Import() declare private readonly ordrConfigViewService: OrdrConfigViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { setting, sessionID } = ctx.params as {
            setting?: string;
            sessionID?: string;
        };

        if (!setting || !sessionID) throw new Exception(EApplicationError.SESSION_EXPIRED);

        if (!this.isBooleanSetting(setting)) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Unknown render setting.");
        }

        const data = await this.getData(ctx, sessionID);

        if (data.draft.source === EOrdrConfigSource.Preset) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Switch to bot-managed settings before editing.");
        }

        this.validateDependency(data.draft.settings, setting);

        if (setting === "customSkin") {
            this.toggleSkinType(data.draft.settings);
        } else {
            data.draft.settings[setting] = !data.draft.settings[setting];
        }

        this.clearDependentSettings(data.draft.settings, setting);
        data.view = settingViews[setting];

        await ctx.deferUpdate();
        await this.persist(ctx, sessionID, data);
    }

    private toggleSkinType(settings: OrdrSettingsDto): void {
        settings.customSkin = !settings.customSkin;
        settings.skin = settings.customSkin ? "" : this.ordrConfigService.defaults().skin;
    }

    private clearDependentSettings(settings: OrdrSettingsDto, setting: TOrdrBooleanSetting): void {
        if (setting === "showHitErrorMeter" && !settings.showHitErrorMeter) {
            settings.showUnstableRate = false;
        }

        if (setting === "showScoreboard" && !settings.showScoreboard) {
            settings.showAvatarsOnScoreboard = false;
        }

        if (setting === "showHitCounter" && !settings.showHitCounter) {
            settings.showSliderBreaks = false;
        }

        if (setting === "loadStoryboard" && !settings.loadStoryboard) {
            settings.loadVideo = false;
        }
    }

    private validateDependency(settings: OrdrSettingsDto, setting: TOrdrBooleanSetting): void {
        if (setting === "showUnstableRate" && !settings.showHitErrorMeter) {
            throw new Exception(
                EApplicationError.INPUT_ERROR,
                "Enable the hit error meter before enabling unstable rate.",
            );
        }

        if (setting === "showAvatarsOnScoreboard" && !settings.showScoreboard) {
            throw new Exception(
                EApplicationError.INPUT_ERROR,
                "Enable the scoreboard before enabling scoreboard avatars.",
            );
        }

        if (setting === "showSliderBreaks" && !settings.showHitCounter) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Enable the hit counter before enabling slider breaks.");
        }

        if (setting === "loadVideo" && !settings.loadStoryboard) {
            throw new Exception(
                EApplicationError.INPUT_ERROR,
                "Enable storyboard loading before enabling background video.",
            );
        }
    }

    private isBooleanSetting(value: string): value is TOrdrBooleanSetting {
        return (booleanSettings as ReadonlyArray<string>).includes(value);
    }

    private async getData(ctx: ComponentContext, sessionID: string): Promise<OrdrConfigViewDto> {
        const plain = await this.sessionService.get("ordr_config_view", sessionID);
        if (!plain) throw new Exception(EApplicationError.SESSION_EXPIRED);

        const data = plainToInstance(OrdrConfigViewDto, plain);
        if (data.authorID !== ctx.author.id) throw new Exception(EApplicationError.ACCESS_ERROR);

        return data;
    }

    private async persist(ctx: ComponentContext, sessionID: string, data: OrdrConfigViewDto): Promise<void> {
        await this.sessionService.update("ordr_config_view", sessionID, data, this.ordrConfigViewService.getTtl());
        await ctx.update(this.ordrConfigViewService.build(sessionID, data));
    }
}

@Modal(/^ordr_config_modal:(?<action>skin|audio|cursor|background):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OrdrConfigModalComponent extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly ordrService: OrdrService;
    @Import() declare private readonly ordrConfigViewService: OrdrConfigViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { action, sessionID } = ctx.params as {
            action?: TOrdrConfigModal;
            sessionID?: string;
        };

        if (!action || !sessionID) throw new Exception(EApplicationError.SESSION_EXPIRED);

        const data = await this.getData(ctx, sessionID);

        if (data.draft.source === EOrdrConfigSource.Preset) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Switch to bot-managed settings before editing.");
        }

        switch (action) {
            case "skin":
                await this.applySkin(ctx, data.draft.settings);
                data.view = EOrdrConfigView.Output;
                break;

            case "audio":
                this.applyAudio(ctx, data.draft.settings);
                data.view = EOrdrConfigView.Audio;
                break;

            case "cursor":
                this.applyCursor(ctx, data.draft.settings);
                data.view = EOrdrConfigView.Gameplay;
                break;

            case "background":
                this.applyBackground(ctx, data.draft.settings);
                data.view = EOrdrConfigView.Background;
                break;
        }

        await ctx.deferUpdate();
        await this.persist(ctx, sessionID, data);
    }

    private async applySkin(ctx: ComponentContext, settings: OrdrSettingsDto): Promise<void> {
        const input = (ctx.getTextInput("skin") ?? "").trim();

        if (!input) {
            throw new Exception(EApplicationError.INPUT_ERROR, "A skin name or ID is required.");
        }

        if (settings.customSkin) {
            const id = Number(input);

            if (!Number.isInteger(id) || id <= 0) {
                throw new Exception(EApplicationError.INPUT_ERROR, "Custom skins must use a positive numeric skin ID.");
            }

            const customSkin = await this.ordrService.customSkin(id);

            if (!customSkin) {
                throw new Exception(
                    EApplicationError.INPUT_ERROR,
                    "That custom o!rdr skin does not exist or is unavailable.",
                );
            }

            settings.skin = String(id);
            return;
        }

        const lookup = await this.ordrService.lookupOfficialSkin(input);

        if (!lookup.match) {
            const suggestions = lookup.suggestions.map((skin) => `\`${skin.presentationName}\``).join(", ");

            const suffix = suggestions ? ` Closest matches: ${suggestions}.` : "";

            throw new Exception(EApplicationError.INPUT_ERROR, `That official o!rdr skin does not exist.${suffix}`);
        }

        settings.skin = lookup.match.skin;
    }

    private applyAudio(ctx: ComponentContext, settings: OrdrSettingsDto): void {
        settings.globalVolume = this.integer(ctx, "global_volume", 0, 100);
        settings.musicVolume = this.integer(ctx, "music_volume", 0, 100);
        settings.hitsoundVolume = this.integer(ctx, "hitsound_volume", 0, 100);
    }

    private applyCursor(ctx: ComponentContext, settings: OrdrSettingsDto): void {
        settings.cursorSize = this.number(ctx, "cursor_size", 0.5, 2);
    }

    private applyBackground(ctx: ComponentContext, settings: OrdrSettingsDto): void {
        settings.introBGDim = this.integer(ctx, "intro_dim", 0, 100);
        settings.inGameBGDim = this.integer(ctx, "gameplay_dim", 0, 100);
        settings.breakBGDim = this.integer(ctx, "break_dim", 0, 100);
    }

    private number(ctx: ComponentContext, id: string, min: number, max: number): number {
        const raw = (ctx.getTextInput(id) ?? "").trim();
        const value = Number(raw);

        if (!raw || !Number.isFinite(value) || value < min || value > max) {
            throw new Exception(EApplicationError.INPUT_ERROR, `${id} must be between ${min} and ${max}.`);
        }

        return value;
    }

    private integer(ctx: ComponentContext, id: string, min: number, max: number): number {
        const value = this.number(ctx, id, min, max);

        if (!Number.isInteger(value)) {
            throw new Exception(EApplicationError.INPUT_ERROR, `${id} must be a whole number.`);
        }

        return value;
    }

    private async getData(ctx: ComponentContext, sessionID: string): Promise<OrdrConfigViewDto> {
        const plain = await this.sessionService.get("ordr_config_view", sessionID);
        if (!plain) throw new Exception(EApplicationError.SESSION_EXPIRED);

        const data = plainToInstance(OrdrConfigViewDto, plain);
        if (data.authorID !== ctx.author.id) throw new Exception(EApplicationError.ACCESS_ERROR);

        return data;
    }

    private async persist(ctx: ComponentContext, sessionID: string, data: OrdrConfigViewDto): Promise<void> {
        await this.sessionService.update("ordr_config_view", sessionID, data, this.ordrConfigViewService.getTtl());
        await ctx.update(this.ordrConfigViewService.build(sessionID, data));
    }
}

class OrdrConfigModalFactory {
    public static create(action: TOrdrConfigModal, sessionID: string, settings: OrdrSettingsDto): ModalBuilder {
        const modal = new ModalBuilder().setCustomId(`ordr_config_modal:${action}:${sessionID}`);

        switch (action) {
            case "skin":
                modal.setTitle(settings.customSkin ? "Custom Render Skin" : "Official Render Skin");

                this.addInput(
                    modal,
                    "skin",
                    settings.customSkin ? "Custom Skin ID" : "Official Skin Name or ID",
                    settings.skin || undefined,
                    settings.customSkin ? "1234" : "Skin name or ID",
                    100,
                );
                break;

            case "audio":
                modal.setTitle("Render Audio");
                this.addInput(modal, "global_volume", "Global Volume", settings.globalVolume, "0-100", 3);
                this.addInput(modal, "music_volume", "Music Volume", settings.musicVolume, "0-100", 3);
                this.addInput(modal, "hitsound_volume", "Hitsound Volume", settings.hitsoundVolume, "0-100", 3);
                break;

            case "cursor":
                modal.setTitle("Render Cursor");
                this.addInput(modal, "cursor_size", "Cursor Size", settings.cursorSize, "0.50-2.00", 4);
                break;

            case "background":
                modal.setTitle("Background Dimming");
                this.addInput(modal, "intro_dim", "Intro Dim", settings.introBGDim, "0-100", 3);
                this.addInput(modal, "gameplay_dim", "Gameplay Dim", settings.inGameBGDim, "0-100", 3);
                this.addInput(modal, "break_dim", "Break Dim", settings.breakBGDim, "0-100", 3);
                break;
        }

        return modal;
    }

    private static addInput(
        modal: ModalBuilder,
        id: string,
        label: string,
        value: string | number | undefined,
        placeholder: string,
        maxLength: number,
    ): void {
        const input = new TextInputBuilder()
            .setCustomId(id)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(maxLength)
            .setPlaceholder(placeholder);

        if (value !== undefined && String(value).length) input.setValue(String(value));

        modal.addLabelComponents(new LabelBuilder().setLabel(label).setTextInputComponent(input));
    }
}
