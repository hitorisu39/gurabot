import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { ActionRow } from "@/core/discord/ui/ActionRow";
import { Embed } from "@/core/discord/ui/Embed";
import { SelectMenu } from "@/core/discord/ui/SelectMenu";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { EOrdrConfigSource, OrdrSettingsDto } from "@domain/ordr/OrdrConfig.dto";
import { EOrdrConfigView, OrdrConfigViewDto } from "@domain/ordr/views/OrdrConfig.view";
import { ButtonStyle } from "discord.js";

export class OrdrConfigViewService extends AbstractViewService<OrdrConfigViewDto> {
    protected readonly ttl: number = 300;

    public build(sessionID: string, data: OrdrConfigViewDto): TMessagePayload {
        return {
            embeds: [this.embed(data)],
            components: this.components(sessionID, data),
        };
    }

    private embed(data: OrdrConfigViewDto): Embed {
        const embed = new Embed().setTitle("o!rdr configuration").setFooter({
            text: this.isDirty(data) ? "Unsaved changes" : "No unsaved changes",
        });

        switch (data.view) {
            case EOrdrConfigView.Output:
                return this.output(embed, data);
            case EOrdrConfigView.Audio:
                return this.audio(embed, data);
            case EOrdrConfigView.HUD:
                return this.hud(embed, data);
            case EOrdrConfigView.Gameplay:
                return this.gameplay(embed, data);
            case EOrdrConfigView.Background:
                return this.background(embed, data);
            case EOrdrConfigView.Overview:
            default:
                return this.overview(embed, data);
        }
    }

    private overview(embed: Embed, data: OrdrConfigViewDto): Embed {
        if (data.draft.source === EOrdrConfigSource.Preset) {
            return this.presetOverview(embed, data);
        }

        return this.botSettingsOverview(embed, data);
    }

    private presetOverview(embed: Embed, data: OrdrConfigViewDto): Embed {
        const preset = data.preset;

        if (!preset) {
            return embed.setDescription(
                [
                    "**Using issou.best preset**",
                    "",
                    "The selected preset is no longer available.",
                    "Refresh the preset or switch to bot settings.",
                ].join("\n"),
            );
        }

        return embed.setDescription(
            [
                "**Using issou.best preset**",
                "",
                `Preset: **${preset.presetName}**`,
                this.formatPresetTimestamp(preset.lastSavedOn),
                "",
                "Bot-managed settings are not used while this preset is selected.",
            ].join("\n"),
        );
    }

    private botSettingsOverview(embed: Embed, data: OrdrConfigViewDto): Embed {
        const settings = data.draft.settings;

        const lines = [
            "**Using bot settings**",
            "",
            `Skin: \`${this.skin(settings)}\``,
            `Resolution: \`${settings.resolution}\``,
            `Result screen: \`${this.state(settings.showResultScreen)}\``,
        ];

        if (data.preset) {
            lines.push("", `issou.best preset available: **${data.preset.presetName}**`);
        }

        return embed.setDescription(lines.join("\n"));
    }

    private output(embed: Embed, data: OrdrConfigViewDto): Embed {
        const settings = data.draft.settings;

        return embed.setDescription(this.sourceNotice(data)).addFields({
            name: "Output",
            value: [
                `Skin: \`${this.skin(settings)}\``,
                `Resolution: \`${settings.resolution}\``,
                `Skip intro: \`${this.state(settings.skip)}\``,
                `Result screen: \`${this.state(settings.showResultScreen)}\``,
            ].join("\n"),
        });
    }

    private audio(embed: Embed, data: OrdrConfigViewDto): Embed {
        const settings = data.draft.settings;

        return embed.setDescription(this.sourceNotice(data)).addFields({
            name: "Audio",
            value: [
                `Global volume: \`${settings.globalVolume}%\``,
                `Music volume: \`${settings.musicVolume}%\``,
                `Hitsound volume: \`${settings.hitsoundVolume}%\``,
                `Skin hitsounds: \`${this.state(settings.useSkinHitsounds)}\``,
                `Nightcore samples: \`${this.state(settings.playNightcoreSamples)}\``,
            ].join("\n"),
        });
    }

    private hud(embed: Embed, data: OrdrConfigViewDto): Embed {
        const settings = data.draft.settings;

        return embed.setDescription(this.sourceNotice(data)).addFields(
            {
                name: "Main HUD",
                value: [
                    `Hit error meter: \`${this.state(settings.showHitErrorMeter)}\``,
                    `Unstable rate: \`${this.state(settings.showUnstableRate)}\``,
                    `Score: \`${this.state(settings.showScore)}\``,
                    `HP bar: \`${this.state(settings.showHPBar)}\``,
                    `Combo counter: \`${this.state(settings.showComboCounter)}\``,
                ].join("\n"),
                inline: true,
            },
            {
                name: "Counters",
                value: [
                    `PP counter: \`${this.state(settings.showPPCounter)}\``,
                    `Hit counter: \`${this.state(settings.showHitCounter)}\``,
                    `Slider breaks: \`${this.state(settings.showSliderBreaks)}\``,
                    `Key overlay: \`${this.state(settings.showKeyOverlay)}\``,
                    `Aim error meter: \`${this.state(settings.showAimErrorMeter)}\``,
                ].join("\n"),
                inline: true,
            },
            {
                name: "Additional",
                value: [
                    `Scoreboard: \`${this.state(settings.showScoreboard)}\``,
                    `Scoreboard avatars: \`${this.state(settings.showAvatarsOnScoreboard)}\``,
                    `Mods: \`${this.state(settings.showMods)}\``,
                    `Playfield borders: \`${this.state(settings.showBorders)}\``,
                    `Strain graph: \`${this.state(settings.showStrainGraph)}\``,
                ].join("\n"),
            },
        );
    }

    private gameplay(embed: Embed, data: OrdrConfigViewDto): Embed {
        const settings = data.draft.settings;

        return embed.setDescription(this.sourceNotice(data)).addFields({
            name: "Gameplay",
            value: [
                `Skin cursor: \`${this.state(settings.useSkinCursor)}\``,
                `Cursor trail: \`${this.state(settings.cursorTrail)}\``,
                `Cursor size: \`${settings.cursorSize.toFixed(2)}x\``,
                `Skin combo colors: \`${this.state(settings.useSkinColors)}\``,
                `Beatmap combo colors: \`${this.state(settings.useBeatmapColors)}\``,
                `Slider snaking in: \`${this.state(settings.sliderSnakingIn)}\``,
                `Slider snaking out: \`${this.state(settings.sliderSnakingOut)}\``,
                `Ignore replay failure: \`${this.state(settings.ignoreFail)}\``,
            ].join("\n"),
        });
    }

    private background(embed: Embed, data: OrdrConfigViewDto): Embed {
        const settings = data.draft.settings;

        return embed.setDescription(this.sourceNotice(data)).addFields({
            name: "Background",
            value: [
                `Storyboard: \`${this.state(settings.loadStoryboard)}\``,
                `Background video: \`${this.state(settings.loadVideo)}\``,
                `Intro dim: \`${settings.introBGDim}%\``,
                `Gameplay dim: \`${settings.inGameBGDim}%\``,
                `Break dim: \`${settings.breakBGDim}%\``,
                `danser logo: \`${this.state(settings.showDanserLogo)}\``,
            ].join("\n"),
        });
    }

    private components(sessionID: string, data: OrdrConfigViewDto): Array<ActionRow> {
        const rows: Array<ActionRow> = [this.navigation(sessionID, data)];

        switch (data.view) {
            case EOrdrConfigView.Overview:
                rows.push(this.overviewControls(sessionID, data));
                break;

            case EOrdrConfigView.Output:
                rows.push(this.outputControls(sessionID, data));
                break;

            case EOrdrConfigView.Audio:
                rows.push(this.audioControls(sessionID, data));
                break;

            case EOrdrConfigView.HUD:
                rows.push(...this.hudControls(sessionID, data));
                break;

            case EOrdrConfigView.Gameplay:
                rows.push(...this.gameplayControls(sessionID, data));
                break;

            case EOrdrConfigView.Background:
                rows.push(this.backgroundControls(sessionID, data));
                break;
        }

        rows.push(this.actionControls(sessionID, data));
        return rows;
    }

    private navigation(sessionID: string, data: OrdrConfigViewDto): ActionRow {
        const menu = new SelectMenu(`ordr_config_page:${sessionID}`)
            .setCurrent(data.view)
            .addChoice("Overview", EOrdrConfigView.Overview, "Configuration source and preset status")
            .addChoice("Output", EOrdrConfigView.Output, "Skin, resolution, intro, and result screen")
            .addChoice("Audio", EOrdrConfigView.Audio, "Volume and hitsound settings")
            .addChoice("HUD", EOrdrConfigView.HUD, "Counters and overlays")
            .addChoice("Gameplay", EOrdrConfigView.Gameplay, "Cursor and gameplay presentation")
            .addChoice("Background", EOrdrConfigView.Background, "Storyboard, video, and dim levels");

        return new ActionRow().add(menu);
    }

    private overviewControls(sessionID: string, data: OrdrConfigViewDto): ActionRow {
        return new ActionRow()
            .addButton(
                "Use bot settings",
                `ordr_config_action:source_bot:${sessionID}`,
                data.draft.source === EOrdrConfigSource.Bot ? ButtonStyle.Primary : ButtonStyle.Secondary,
            )
            .addButton(
                "Use issou.best preset",
                `ordr_config_action:source_preset:${sessionID}`,
                data.draft.source === EOrdrConfigSource.Preset ? ButtonStyle.Primary : ButtonStyle.Secondary,
                { disabled: !data.preset },
            )
            .addButton("Refresh preset", `ordr_config_action:refresh:${sessionID}`, ButtonStyle.Secondary);
    }

    private outputControls(sessionID: string, data: OrdrConfigViewDto): ActionRow {
        const settings = data.draft.settings;
        const locked = this.isExternal(data);

        return new ActionRow()
            .addButton(
                this.label("Skin", this.skin(settings)),
                `ordr_config_action:skin:${sessionID}`,
                ButtonStyle.Secondary,
                { disabled: locked },
            )
            .addButton(
                `Custom skin: ${this.state(settings.customSkin)}`,
                `ordr_config_toggle:customSkin:${sessionID}`,
                settings.customSkin ? ButtonStyle.Success : ButtonStyle.Secondary,
                { disabled: locked },
            )
            .addButton(
                `Resolution: ${settings.resolution}`,
                `ordr_config_action:resolution:${sessionID}`,
                ButtonStyle.Secondary,
                { disabled: locked },
            )
            .addButton(
                `Skip intro: ${this.state(settings.skip)}`,
                `ordr_config_toggle:skip:${sessionID}`,
                settings.skip ? ButtonStyle.Success : ButtonStyle.Secondary,
                { disabled: locked },
            )
            .addButton(
                `Result screen: ${this.state(settings.showResultScreen)}`,
                `ordr_config_toggle:showResultScreen:${sessionID}`,
                settings.showResultScreen ? ButtonStyle.Success : ButtonStyle.Secondary,
                { disabled: locked },
            );
    }

    private audioControls(sessionID: string, data: OrdrConfigViewDto): ActionRow {
        const settings = data.draft.settings;
        const locked = this.isExternal(data);

        return new ActionRow()
            .addButton("Edit volumes", `ordr_config_action:audio:${sessionID}`, ButtonStyle.Secondary, {
                disabled: locked,
            })
            .addButton(
                `Skin hitsounds: ${this.state(settings.useSkinHitsounds)}`,
                `ordr_config_toggle:useSkinHitsounds:${sessionID}`,
                settings.useSkinHitsounds ? ButtonStyle.Success : ButtonStyle.Secondary,
                { disabled: locked },
            )
            .addButton(
                `Nightcore: ${this.state(settings.playNightcoreSamples)}`,
                `ordr_config_toggle:playNightcoreSamples:${sessionID}`,
                settings.playNightcoreSamples ? ButtonStyle.Success : ButtonStyle.Secondary,
                { disabled: locked },
            );
    }

    private hudControls(sessionID: string, data: OrdrConfigViewDto): Array<ActionRow> {
        const settings = data.draft.settings;
        const locked = this.isExternal(data);

        const first = new ActionRow();

        this.addToggle(first, sessionID, "Hit error", "showHitErrorMeter", settings.showHitErrorMeter, locked);
        this.addToggle(
            first,
            sessionID,
            "Unstable rate",
            "showUnstableRate",
            settings.showUnstableRate,
            locked || !settings.showHitErrorMeter,
        );
        this.addToggle(first, sessionID, "Score", "showScore", settings.showScore, locked);
        this.addToggle(first, sessionID, "HP", "showHPBar", settings.showHPBar, locked);
        this.addToggle(first, sessionID, "Combo", "showComboCounter", settings.showComboCounter, locked);

        const second = new ActionRow();

        this.addToggle(second, sessionID, "PP", "showPPCounter", settings.showPPCounter, locked);
        this.addToggle(second, sessionID, "Hit counter", "showHitCounter", settings.showHitCounter, locked);
        this.addToggle(
            second,
            sessionID,
            "Slider breaks",
            "showSliderBreaks",
            settings.showSliderBreaks,
            locked || !settings.showHitCounter,
        );
        this.addToggle(second, sessionID, "Keys", "showKeyOverlay", settings.showKeyOverlay, locked);
        this.addToggle(second, sessionID, "Aim error", "showAimErrorMeter", settings.showAimErrorMeter, locked);

        const third = new ActionRow();

        this.addToggle(third, sessionID, "Scoreboard", "showScoreboard", settings.showScoreboard, locked);
        this.addToggle(
            third,
            sessionID,
            "Avatars",
            "showAvatarsOnScoreboard",
            settings.showAvatarsOnScoreboard,
            locked || !settings.showScoreboard,
        );
        this.addToggle(third, sessionID, "Mods", "showMods", settings.showMods, locked);
        this.addToggle(third, sessionID, "Borders", "showBorders", settings.showBorders, locked);
        this.addToggle(third, sessionID, "Strain graph", "showStrainGraph", settings.showStrainGraph, locked);

        return [first, second, third];
    }

    private gameplayControls(sessionID: string, data: OrdrConfigViewDto): Array<ActionRow> {
        const settings = data.draft.settings;
        const locked = this.isExternal(data);

        const first = new ActionRow();

        this.addToggle(first, sessionID, "Skin cursor", "useSkinCursor", settings.useSkinCursor, locked);
        this.addToggle(first, sessionID, "Cursor trail", "cursorTrail", settings.cursorTrail, locked);
        this.addToggle(first, sessionID, "Skin colors", "useSkinColors", settings.useSkinColors, locked);
        this.addToggle(first, sessionID, "Map colors", "useBeatmapColors", settings.useBeatmapColors, locked);
        this.addToggle(first, sessionID, "Snake in", "sliderSnakingIn", settings.sliderSnakingIn, locked);

        const second = new ActionRow();

        this.addToggle(second, sessionID, "Snake out", "sliderSnakingOut", settings.sliderSnakingOut, locked);
        this.addToggle(second, sessionID, "Ignore fail", "ignoreFail", settings.ignoreFail, locked);
        second.addButton(
            `Cursor size: ${settings.cursorSize.toFixed(2)}x`,
            `ordr_config_action:cursor:${sessionID}`,
            ButtonStyle.Secondary,
            { disabled: locked },
        );

        return [first, second];
    }

    private backgroundControls(sessionID: string, data: OrdrConfigViewDto): ActionRow {
        const settings = data.draft.settings;
        const locked = this.isExternal(data);
        const row = new ActionRow();

        this.addToggle(row, sessionID, "Storyboard", "loadStoryboard", settings.loadStoryboard, locked);
        this.addToggle(row, sessionID, "Video", "loadVideo", settings.loadVideo, locked || !settings.loadStoryboard);
        this.addToggle(row, sessionID, "danser logo", "showDanserLogo", settings.showDanserLogo, locked);
        row.addButton("Edit dim levels", `ordr_config_action:background:${sessionID}`, ButtonStyle.Secondary, {
            disabled: locked,
        });

        return row;
    }

    private actionControls(sessionID: string, data: OrdrConfigViewDto): ActionRow {
        const dirty = this.isDirty(data);
        const unavailablePreset = data.draft.source === EOrdrConfigSource.Preset && !data.preset;

        return new ActionRow()
            .addButton("Save", `ordr_config_action:save:${sessionID}`, ButtonStyle.Success, {
                disabled: !dirty || unavailablePreset,
            })
            .addButton("Discard", `ordr_config_action:discard:${sessionID}`, ButtonStyle.Secondary, {
                disabled: !dirty,
            })
            .addButton("Reset bot settings", `ordr_config_action:reset:${sessionID}`, ButtonStyle.Danger);
    }

    private addToggle(
        row: ActionRow,
        sessionID: string,
        label: string,
        setting: string,
        enabled: boolean,
        disabled: boolean,
    ): void {
        row.addButton(
            `${label}: ${this.state(enabled)}`,
            `ordr_config_toggle:${setting}:${sessionID}`,
            enabled ? ButtonStyle.Success : ButtonStyle.Secondary,
            { disabled },
        );
    }

    private isDirty(data: OrdrConfigViewDto): boolean {
        const original = {
            source: data.original.source,
            settings: data.original.settings,
        };

        const draft = {
            source: data.draft.source,
            settings: data.draft.settings,
        };

        return JSON.stringify(original) !== JSON.stringify(draft);
    }

    private isExternal(data: OrdrConfigViewDto): boolean {
        return data.draft.source === EOrdrConfigSource.Preset;
    }

    private sourceNotice(data: OrdrConfigViewDto): string {
        if (!this.isExternal(data)) return "These settings are managed by the bot.";

        return [
            "The issou.best account preset is currently selected.",
            "Bot-managed controls are disabled because o!rdr will apply the external preset.",
        ].join("\n");
    }

    private skin(settings: OrdrSettingsDto): string {
        if (!settings.skin) return settings.customSkin ? "Custom skin not set" : "Skin not set";
        return settings.customSkin ? `Custom #${settings.skin}` : settings.skin;
    }

    private state(value: boolean): string {
        return value ? "On" : "Off";
    }

    private label(name: string, value: string): string {
        const label = `${name}: ${value}`;
        return label.length <= 80 ? label : `${label.slice(0, 77)}...`;
    }

    private formatPresetTimestamp(value: string): string {
        const timestamp = Date.parse(value);
        return Number.isFinite(timestamp) ? `Last saved <t:${Math.floor(timestamp / 1000)}:R>` : `Last saved: ${value}`;
    }
}
