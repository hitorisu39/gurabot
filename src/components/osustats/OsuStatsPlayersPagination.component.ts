import { Button, Import, Modal } from "@/core/decorators";
import { AbstractComponent } from "@/core/discord/AbstractComponent";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { SessionService } from "@/modules/cache/Session.service";
import { OsuStatsPlayersViewDto } from "@domain/osustats/views/OsuStatsPlayers.view";
import { plainToInstance } from "class-transformer";
import { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { OsuStatsPlayersViewService } from "@/modules/osustats/OsuStatsPlayersView.service";
import { osuStatsPlayersMaxPages, osuStatsPlayersPageSize } from "@domain/osustats/configs/OsuStats.config";

@Button(/^osustats_players_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OsuStatsPlayersPaginationComponent extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly osuStatsPlayersViewService: OsuStatsPlayersViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { action, sessionID } = ctx.params;
        if (!sessionID || !action) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const plain = await this.sessionService.get("osustats_players_view", sessionID);
        if (!plain) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = plainToInstance(OsuStatsPlayersViewDto, plain);
        if (data.authorID !== ctx.author.id) {
            throw new Exception(EApplicationError.ACCESS_ERROR);
        }

        if (action === "modal") {
            return await this.showPageModal(ctx, sessionID, data);
        }

        let newPage = data.page;

        switch (action) {
            case "first":
                newPage = 1;
                break;
            case "prev":
                newPage = Math.max(1, data.page - 1);
                break;
            case "next":
                if (data.lastPage === undefined || data.page < data.lastPage) {
                    newPage = Math.min(data.page + 1, osuStatsPlayersMaxPages);
                }
                break;
            case "last":
                if (data.lastPage !== undefined) {
                    newPage = data.lastPage;
                }
                break;
        }

        if (newPage === data.page) {
            return;
        }

        await ctx.deferUpdate();
        await this.loadPage(data, newPage);

        await this.sessionService.update(
            "osustats_players_view",
            sessionID,
            data,
            this.osuStatsPlayersViewService.getTtl(),
        );

        await ctx.update(this.osuStatsPlayersViewService.build(sessionID, data));
    }

    private async loadPage(data: OsuStatsPlayersViewDto, page: number): Promise<void> {
        const result = await this.osuStatsPlayersViewService.fetchPage(data, page);
        if (!result.length) {
            if (page > data.page) {
                data.lastPage = data.page;
            }

            return;
        }

        data.page = page;
        data.players = result;

        if (result.length < osuStatsPlayersPageSize) {
            data.lastPage = page;
        }

        if (page >= osuStatsPlayersMaxPages) {
            data.lastPage = osuStatsPlayersMaxPages;
        }
    }

    private async showPageModal(ctx: ComponentContext, sessionID: string, data: OsuStatsPlayersViewDto): Promise<void> {
        const maxPage = data.lastPage ?? osuStatsPlayersMaxPages;

        const modal = new ModalBuilder().setCustomId(`osustats_players_modal:${sessionID}`).setTitle("Jump to Page");

        const pageInput = new TextInputBuilder()
            .setCustomId("page_number")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(maxPage.toString().length);

        modal.addLabelComponents(
            new LabelBuilder()
                .setLabel(
                    data.lastPage !== undefined
                        ? `Page number (1-${data.lastPage})`
                        : `Page number (1-${osuStatsPlayersMaxPages})`,
                )
                .setTextInputComponent(pageInput),
        );

        await ctx.showModal(modal);
    }
}

@Modal(/^osustats_players_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OsuStatsPlayersPaginationModal extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly osuStatsPlayersViewService: OsuStatsPlayersViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { sessionID } = ctx.params;

        if (!sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const plain = await this.sessionService.get("osustats_players_view", sessionID);
        if (!plain) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = plainToInstance(OsuStatsPlayersViewDto, plain);
        if (data.authorID !== ctx.author.id) {
            throw new Exception(EApplicationError.ACCESS_ERROR);
        }

        const input = ctx.getTextInput("page_number");
        if (!input) {
            throw new Exception(EApplicationError.INPUT_ERROR);
        }

        const newPage = parseInt(input, 10);
        const maxPage = data.lastPage ?? osuStatsPlayersMaxPages;

        if (Number.isNaN(newPage) || newPage < 1 || newPage > maxPage || newPage === data.page) {
            return;
        }

        await ctx.deferUpdate();

        const result = await this.osuStatsPlayersViewService.fetchPage(data, newPage);

        if (!result.length) {
            return;
        }

        data.page = newPage;
        data.players = result;

        if (result.length < osuStatsPlayersPageSize || newPage >= osuStatsPlayersMaxPages) {
            data.lastPage = newPage;
        }

        await this.sessionService.update(
            "osustats_players_view",
            sessionID,
            data,
            this.osuStatsPlayersViewService.getTtl(),
        );

        await ctx.update(this.osuStatsPlayersViewService.build(sessionID, data));
    }
}
