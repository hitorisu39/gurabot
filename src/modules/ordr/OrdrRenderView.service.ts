import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { ActionRow } from "@/core/discord/ui/ActionRow";
import { Embed } from "@/core/discord/ui/Embed";
import { SelectMenu } from "@/core/discord/ui/SelectMenu";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { ordrDataDelimiter } from "@domain/ordr/configs/Ordr.config";
import { EOrdrConfigSource } from "@domain/ordr/OrdrConfig.dto";
import { EOrdrRenderStage, OrdrRenderViewDto, OrdrSkinChoiceDto } from "@domain/ordr/views/OrdrRender.view";
import { ButtonStyle } from "discord.js";

export class OrdrRenderViewService extends AbstractViewService<OrdrRenderViewDto> {
    protected readonly ttl: number = 300;

    public build(sessionID: string, data: OrdrRenderViewDto): TMessagePayload {
        switch (data.stage) {
            case EOrdrRenderStage.Submitting:
                return this.submitting();
            case EOrdrRenderStage.Queued:
            case EOrdrRenderStage.Rendering:
                return this.progress(data);
            case EOrdrRenderStage.Done:
                return this.done(data);
            case EOrdrRenderStage.Failed:
                return this.failed(data);
            case EOrdrRenderStage.Confirmation:
            default:
                return this.confirmation(sessionID, data);
        }
    }

    private confirmation(sessionID: string, data: OrdrRenderViewDto): TMessagePayload {
        const selectedSkin = this.selectedSkin(data);

        const configuration =
            data.config.source === EOrdrConfigSource.Preset
                ? `Preset \`${data.preset?.presetName ?? "Unavailable"}\``
                : "Bot settings";

        const skin =
            data.config.source === EOrdrConfigSource.Preset
                ? "preset skin"
                : (selectedSkin?.label ?? this.fallbackSkin(data));

        const description = [
            `**Replay:** \`${this.limit(data.replay.name, 60)}\`${ordrDataDelimiter}${this.formatBytes(data.replay.size)}`,
            `**Render:** ${configuration}${ordrDataDelimiter}${skin}${ordrDataDelimiter}\`${data.config.settings.resolution}\``,
        ];

        if (data.notice) {
            description.push(`⚠️ ${data.notice}`);
        }

        const components: Array<ActionRow> = [];

        if (this.shouldShowSkinMenu(data)) {
            const menu = new SelectMenu(`ordr_render_skin:${sessionID}`);

            for (let index = 0; index < data.skins.length; index++) {
                const choice = data.skins[index]!;

                menu.addChoice(this.limit(choice.label, 100), String(index), this.limit(choice.description, 100));
            }

            const selectedIndex = data.skins.findIndex(
                (choice) =>
                    data.config.source === EOrdrConfigSource.Bot &&
                    choice.skin === data.config.settings.skin &&
                    choice.customSkin === data.config.settings.customSkin,
            );

            if (selectedIndex >= 0) {
                menu.setCurrent(String(selectedIndex));
            }

            components.push(new ActionRow().add(menu));
        }

        components.push(
            new ActionRow()
                .addButton("Render", `ordr_render_action:render:${sessionID}`, ButtonStyle.Success)
                .addButton("Cancel", `ordr_render_action:cancel:${sessionID}`, ButtonStyle.Danger),
        );

        return {
            embeds: [
                new Embed().setTitle("Render replay?").setDescription(description.join("\n")).setFooter({
                    text: "Five-minute cooldown applies",
                }),
            ],
            components,
        };
    }

    private submitting(): TMessagePayload {
        return {
            embeds: [
                new Embed()
                    .setTitle("Submitting render")
                    .setDescription("Downloading the replay attachment and sending it to o!rdr..."),
            ],
            components: [],
        };
    }

    private progress(data: OrdrRenderViewDto): TMessagePayload {
        const lines = [
            this.progressBar(data.progress),
            // data.progress ? `Status: \`${this.limit(data.progress, 200)}\`` : "Waiting for a renderer...",
        ];

        if (data.renderer) lines.push(`Renderer: \`${this.limit(data.renderer, 100)}\``);
        if (data.description) lines.push(this.limit(data.description, 1_500));

        return {
            embeds: [
                new Embed()
                    .setTitle(`Rendering replay${data.renderID ? ` #${data.renderID}` : ""}`)
                    .setDescription(lines.join("\n")),
            ],
            components: [],
        };
    }

    private done(data: OrdrRenderViewDto): TMessagePayload {
        return {
            embeds: [
                new Embed()
                    .setTitle("Render complete")
                    .setDescription(
                        data.videoURL ? `[Open rendered video](${data.videoURL})` : "The replay finished rendering.",
                    )
                    .setFooter({
                        text: data.renderID ? `Render #${data.renderID}` : "Render complete",
                    }),
            ],
            components: [],
        };
    }

    private failed(data: OrdrRenderViewDto): TMessagePayload {
        const message = data.errorMessage ?? "The render failed for an unknown reason.";
        const errorCode = data.errorCode === undefined ? "" : `\nError code: \`${data.errorCode}\``;

        return {
            embeds: [new Embed().setTitle("Render failed").setDescription(`${message}${errorCode}`)],
            components: [],
        };
    }

    private shouldShowSkinMenu(data: OrdrRenderViewDto): boolean {
        if (data.config.source === EOrdrConfigSource.Preset) return false;
        if (!data.skins.length) return false;

        return data.skins.some(
            (choice) =>
                choice.skin !== data.config.settings.skin || choice.customSkin !== data.config.settings.customSkin,
        );
    }

    private selectedSkin(data: OrdrRenderViewDto): OrdrSkinChoiceDto | undefined {
        return data.skins.find(
            (choice) =>
                choice.skin === data.config.settings.skin && choice.customSkin === data.config.settings.customSkin,
        );
    }

    private fallbackSkin(data: OrdrRenderViewDto): string {
        return data.config.settings.customSkin
            ? `Custom skin \`#${data.config.settings.skin}\``
            : `Official skin \`${data.config.settings.skin}\``;
    }

    private progressBar(progress?: string): string {
        const match = progress?.match(/(\d+(?:\.\d+)?)\s*%/);

        if (!match) {
            return `\`${"░".repeat(20)}\` Waiting...`;
        }

        const percentage = Math.max(0, Math.min(100, Number(match[1])));
        const barLength = 20;
        const filled = Math.round((percentage / 100) * barLength);
        const empty = barLength - filled;

        return `\`${"█".repeat(filled)}${"░".repeat(empty)}\` ${percentage.toFixed(0)}%`;
    }

    private formatBytes(bytes: number): string {
        if (bytes < 1_024) return `${bytes} B`;
        if (bytes < 1_024 * 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;

        return `${(bytes / (1_024 * 1_024)).toFixed(1)} MB`;
    }

    // should prolly be moved to utils
    private limit(value: string, maximum: number): string {
        return value.length <= maximum ? value : `${value.slice(0, maximum - 3)}...`;
    }
}
