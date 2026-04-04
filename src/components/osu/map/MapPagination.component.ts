import { Button, Modal, Import } from "@/core/decorators";
import { AbstractComponent } from "@/core/discord/AbstractComponent";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { SessionService } from "@/modules/cache/Session.service";
import { MapViewDto } from "@domain/osu/views/Map.view";
import { plainToInstance } from "class-transformer";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { Pagination } from "@domain/discord/utils/Pagination";
import { ModalBuilder, TextInputBuilder, TextInputStyle, LabelBuilder } from "discord.js";
import { MapViewService } from "@/modules/osu/map/MapView.service";

@Button(/^osu_map_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class MapPaginationComponent extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly mapViewService: MapViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { action, sessionID } = ctx.params;
        if (!sessionID || !action) throw new Exception(EApplicationError.SESSION_EXPIRED);

        const plain = await this.sessionService.get("osu_map_view", sessionID);
        if (!plain) throw new Exception(EApplicationError.SESSION_EXPIRED);

        const data = plainToInstance(MapViewDto, plain);
        if (data.authorID !== ctx.author.id) throw new Exception(EApplicationError.ACCESS_ERROR);

        const beatmaps = [...(data.beatmapset.beatmaps || [])].sort((a, b) => a.difficulty - b.difficulty);
        const totalPages = beatmaps.length;
        const currentPage = beatmaps.findIndex((b) => b.id === data.beatmapID) + 1;

        if (action === "modal") {
            const modal = new ModalBuilder().setCustomId(`osu_map_modal:${sessionID}`).setTitle("Jump to Difficulty");
            const pageInput = new TextInputBuilder()
                .setCustomId("page_number")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(totalPages.toString().length);
            const pageLabel = new LabelBuilder()
                .setLabel(`Difficulty Number (1-${totalPages})`)
                .setTextInputComponent(pageInput);

            modal.addLabelComponents(pageLabel);
            return await ctx.showModal(modal);
        }

        const newPage = Pagination.calculateNewPage(action, currentPage, totalPages);
        if (newPage === currentPage) return;

        const beatmap = beatmaps[newPage - 1];
        if (!beatmap) throw new Exception(EApplicationError.INTERNAL_ERROR, `Unknown beatmap index.`);

        data.beatmapID = beatmap.id;

        await ctx.deferUpdate();
        await this.sessionService.update("osu_map_view", sessionID, data, this.mapViewService.getTtl());

        const payload = await this.mapViewService.build(sessionID, data);
        await ctx.update(payload);
    }
}

@Modal(/^osu_map_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class MapPaginationModal extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly mapViewService: MapViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { sessionID } = ctx.params;
        if (!sessionID) throw new Exception(EApplicationError.SESSION_EXPIRED);

        const plain = await this.sessionService.get("osu_map_view", sessionID);
        if (!plain) throw new Exception(EApplicationError.SESSION_EXPIRED);

        const data = plainToInstance(MapViewDto, plain);
        if (data.authorID !== ctx.author.id) throw new Exception(EApplicationError.ACCESS_ERROR);

        const input = ctx.getTextInput("page_number");
        if (!input) throw new Exception(EApplicationError.INPUT_ERROR);

        const newPage = parseInt(input);
        const beatmaps = [...(data.beatmapset.beatmaps || [])].sort((a, b) => a.difficulty - b.difficulty);
        const totalPages = beatmaps.length;

        if (isNaN(newPage) || newPage < 1 || newPage > totalPages) return;

        const beatmap = beatmaps[newPage - 1];
        if (!beatmap) throw new Exception(EApplicationError.INTERNAL_ERROR, `Unknown beatmap index.`);

        data.beatmapID = beatmap.id;

        await ctx.deferUpdate();
        await this.sessionService.update("osu_map_view", sessionID, data, this.mapViewService.getTtl());
        const payload = await this.mapViewService.build(sessionID, data);
        await ctx.update(payload);
    }
}
