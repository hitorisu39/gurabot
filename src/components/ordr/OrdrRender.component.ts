import { AbstractComponent } from "@/core/discord/AbstractComponent";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { Button, Import, SelectMenu } from "@/core/decorators";
import { SessionService } from "@/modules/cache/Session.service";
import { OrdrService } from "@/modules/ordr/Ordr.service";
import { OrdrRenderService } from "@/modules/ordr/OrdrRender.service";
import { OrdrRenderViewService } from "@/modules/ordr/OrdrRenderView.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { TOrdrRenderEvent, TOrdrRenderTerminalEvent } from "@domain/ordr/Ordr.dto";
import { EOrdrConfigSource } from "@domain/ordr/OrdrConfig.dto";
import { EOrdrRenderStage, OrdrRenderViewDto } from "@domain/ordr/views/OrdrRender.view";
import { plainToInstance } from "class-transformer";
import { ThrottledAsyncUpdater } from "@domain/utils/ThrottledAsyncUpdater";

@SelectMenu(/^ordr_render_skin:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OrdrRenderSkinComponent extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly ordrRenderViewService: OrdrRenderViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const sessionID = ctx.params.sessionID;
        if (!sessionID) throw new Exception(EApplicationError.SESSION_EXPIRED);

        const data = await this.getData(ctx, sessionID);

        if (data.stage !== EOrdrRenderStage.Confirmation) {
            throw new Exception(EApplicationError.INPUT_ERROR, "This render can no longer be changed.");
        }

        const index = Number(ctx.values[0]);
        const skin = data.skins[index];

        if (!Number.isInteger(index) || !skin) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Unknown recent skin.");
        }

        data.config.source = EOrdrConfigSource.Bot;
        data.config.settings.skin = skin.skin;
        data.config.settings.customSkin = skin.customSkin;
        data.notice = undefined;

        await ctx.deferUpdate();
        await this.persistAndEdit(ctx, sessionID, data);
    }

    private async getData(ctx: ComponentContext, sessionID: string): Promise<OrdrRenderViewDto> {
        const plain = await this.sessionService.get("ordr_render_view", sessionID);
        if (!plain) throw new Exception(EApplicationError.SESSION_EXPIRED);

        const data = plainToInstance(OrdrRenderViewDto, plain);
        if (data.authorID !== ctx.author.id) {
            throw new Exception(EApplicationError.ACCESS_ERROR);
        }

        return data;
    }

    private async persistAndEdit(ctx: ComponentContext, sessionID: string, data: OrdrRenderViewDto): Promise<void> {
        await this.sessionService.update("ordr_render_view", sessionID, data, this.ordrRenderViewService.getTtl());
        await ctx.editSourceMessage(this.ordrRenderViewService.build(sessionID, data));
    }
}

@Button(/^ordr_render_action:(?<action>render|cancel):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OrdrRenderActionComponent extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly ordrService: OrdrService;
    @Import() declare private readonly ordrRenderService: OrdrRenderService;
    @Import() declare private readonly ordrRenderViewService: OrdrRenderViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { action, sessionID } = ctx.params as {
            action?: "render" | "cancel";
            sessionID?: string;
        };

        if (!action || !sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = await this.getData(ctx, sessionID);

        if (data.stage !== EOrdrRenderStage.Confirmation) {
            throw new Exception(EApplicationError.INPUT_ERROR, "This render confirmation is no longer active.");
        }

        await ctx.deferUpdate();

        if (action === "cancel") {
            await ctx.deferUpdate();
            await ctx.deleteSourceMessage();
            return;
        }

        const created = await this.submit(ctx, sessionID, data);

        if (!created) return;

        data.renderID = created.renderID;
        data.stage = EOrdrRenderStage.Queued;
        data.progress = "Waiting in render queue";
        data.notice = undefined;

        await this.persistAndEdit(ctx, sessionID, data).catch((error) => {
            this.logger.warn(
                {
                    error,
                    renderID: created.renderID,
                },
                "Failed to show accepted o!rdr render",
            );
        });

        void this.track(ctx, sessionID, data).catch((error) => {
            this.logger.error(
                {
                    error,
                    renderID: created.renderID,
                },
                "Unhandled o!rdr render tracking error",
            );
        });
    }

    private async submit(
        ctx: ComponentContext,
        sessionID: string,
        data: OrdrRenderViewDto,
    ): Promise<{ renderID: number } | null> {
        try {
            return await this.ordrRenderService.withSubmissionLock(data.authorID, async () => {
                const remaining = await this.ordrRenderService.cooldownRemaining(data.authorID);

                if (remaining > 0) {
                    const availableAt = Math.floor((Date.now() + remaining) / 1_000);

                    throw new Exception(
                        EApplicationError.INPUT_ERROR,
                        `You can submit another render <t:${availableAt}:R>.`,
                    );
                }

                data.stage = EOrdrRenderStage.Submitting;
                data.notice = undefined;

                await this.persistAndEdit(ctx, sessionID, data);

                const created = await this.ordrService.render(data.authorID, data.replay, data.config);

                await this.ordrRenderService.record(data.authorID, created.renderID, data.config);

                return created;
            });
        } catch (error) {
            data.stage = EOrdrRenderStage.Failed;
            data.errorMessage = this.errorMessage(error);
            data.notice = undefined;

            await this.persistAndEdit(ctx, sessionID, data);
            return null;
        }
    }

    private async track(ctx: ComponentContext, sessionID: string, data: OrdrRenderViewDto): Promise<void> {
        if (data.renderID === undefined) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "Cannot track a render without a render ID.");
        }

        const renderID = data.renderID;

        const updater = new ThrottledAsyncUpdater<OrdrRenderViewDto>(
            async (snapshot) => {
                await this.persistAndEdit(ctx, sessionID, snapshot);
            },
            4_000,
            (error) => {
                this.logger.warn(
                    {
                        error,
                        renderID,
                    },
                    "Failed to update o!rdr progress message",
                );
            },
        );

        try {
            const terminal = await this.ordrService.waitForRender(renderID, (event) => {
                this.applyEvent(data, event);

                if (event.type !== "done" && event.type !== "failed") {
                    updater.push(this.cloneView(data));
                }
            });

            await updater.close(false);

            this.applyTerminalEvent(data, terminal);

            await this.persistAndEdit(ctx, sessionID, data).catch((error) => {
                this.logger.warn({ error, renderID }, "Failed to display final o!rdr render state");
            });

            if (terminal.type === "done") {
                await ctx.sendChannelMessage({
                    content: `<@${data.authorID}> ${terminal.data.videoUrl}`,
                    allowedMentions: {
                        users: [data.authorID],
                    },
                });
            }
        } catch (error) {
            await updater.close(false);

            data.stage = EOrdrRenderStage.Failed;
            data.errorMessage = this.errorMessage(error);

            await this.persistAndEdit(ctx, sessionID, data).catch((editError) => {
                this.logger.warn(
                    {
                        error: editError,
                        renderID,
                    },
                    "Failed to display o!rdr tracking error",
                );
            });
        }
    }

    private applyEvent(data: OrdrRenderViewDto, event: TOrdrRenderEvent): void {
        switch (event.type) {
            case "added":
                data.stage = EOrdrRenderStage.Queued;
                data.progress = "Added to render queue";
                break;

            case "progress":
                data.stage = EOrdrRenderStage.Rendering;
                data.progress = event.data.progress;
                data.renderer = event.data.renderer;
                data.description = event.data.description;
                break;

            case "done":
                data.stage = EOrdrRenderStage.Done;
                data.progress = "Done";
                data.videoURL = event.data.videoUrl;
                break;

            case "failed":
                data.stage = EOrdrRenderStage.Failed;
                data.errorCode = event.data.errorCode;
                data.errorMessage = event.data.errorMessage;
                break;
        }
    }

    private applyTerminalEvent(data: OrdrRenderViewDto, event: TOrdrRenderTerminalEvent): void {
        this.applyEvent(data, event);
    }

    private errorMessage(error: unknown): string {
        if (error instanceof Exception && error.extra_message) {
            return error.extra_message;
        }

        if (error instanceof Error) {
            return error.message;
        }

        return "The render request failed unexpectedly.";
    }

    private cloneView(data: OrdrRenderViewDto): OrdrRenderViewDto {
        return plainToInstance(OrdrRenderViewDto, structuredClone(data));
    }

    private async getData(ctx: ComponentContext, sessionID: string): Promise<OrdrRenderViewDto> {
        const plain = await this.sessionService.get("ordr_render_view", sessionID);

        if (!plain) throw new Exception(EApplicationError.SESSION_EXPIRED);
        const data = plainToInstance(OrdrRenderViewDto, plain);

        if (data.authorID !== ctx.author.id) {
            throw new Exception(EApplicationError.ACCESS_ERROR);
        }

        return data;
    }

    private async persistAndEdit(ctx: ComponentContext, sessionID: string, data: OrdrRenderViewDto): Promise<void> {
        await this.sessionService.update("ordr_render_view", sessionID, data, this.ordrRenderViewService.getTtl());
        await ctx.editSourceMessage(this.ordrRenderViewService.build(sessionID, data));
    }
}
