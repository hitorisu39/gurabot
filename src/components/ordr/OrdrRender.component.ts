import { Button, Import, SelectMenu } from "@/core/decorators";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { AbstractSessionComponent } from "@/components/AbstractSessionComponent";
import { OrdrService } from "@/modules/ordr/Ordr.service";
import { OrdrRenderService } from "@/modules/ordr/OrdrRender.service";
import { OrdrScoreRenderService } from "@/modules/ordr/OrdrScoreRender.service";
import { OrdrRenderViewService } from "@/modules/ordr/OrdrRenderView.service";
import { OsuService } from "@/modules/osu/Osu.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { OrdrRenderCreateDto, TOrdrRenderEvent, TOrdrRenderTerminalEvent } from "@domain/ordr/Ordr.dto";
import { EOrdrConfigSource } from "@domain/ordr/OrdrConfig.dto";
import { EOrdrRenderInput, EOrdrRenderStage, OrdrRenderViewDto } from "@domain/ordr/views/OrdrRender.view";
import { ThrottledAsyncUpdater } from "@domain/utils/ThrottledAsyncUpdater";
import { plainToInstance } from "class-transformer";
import { isValidNumber } from "@domain/utils/utils";

abstract class AbstractOrdrRenderComponent extends AbstractSessionComponent<"ordr_render_view", OrdrRenderViewDto> {
    @Import() declare protected readonly ordrRenderViewService: OrdrRenderViewService;

    protected readonly sessionKey = "ordr_render_view";
    protected readonly dto = OrdrRenderViewDto;

    protected async persistAndEdit(ctx: ComponentContext, sessionID: string, data: OrdrRenderViewDto): Promise<void> {
        await this.session.update(this.sessionKey, sessionID, data, this.ordrRenderViewService.getTtl());
        await ctx.editSourceMessage(this.ordrRenderViewService.build(sessionID, data));
    }

    protected errorMessage(error: unknown): string {
        if (error instanceof Exception && error.extra_message) {
            return error.extra_message;
        }

        if (error instanceof Error) {
            return error.message;
        }

        return "The render request failed unexpectedly.";
    }
}

@SelectMenu(/^ordr_render_skin:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OrdrRenderSkinComponent extends AbstractOrdrRenderComponent {
    public async execute(ctx: ComponentContext): Promise<void> {
        const { sessionID } = ctx.params;

        if (!sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = await this.getData(ctx, sessionID);
        if (data.stage !== EOrdrRenderStage.Confirmation) {
            throw new Exception(EApplicationError.INPUT_ERROR, "This render can no longer be changed.");
        }

        const index = Number(ctx.values[0]);
        const skin = data.skins[index];

        if (!isValidNumber(index) || !skin) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Unknown recent skin.");
        }

        data.config.source = EOrdrConfigSource.Bot;
        data.config.settings.skin = skin.skin;
        data.config.settings.customSkin = skin.customSkin;
        data.notice = undefined;

        await ctx.deferUpdate();
        await this.persistAndEdit(ctx, sessionID, data);
    }
}

@Button(/^ordr_render_cached:(?<action>show|rerender):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OrdrRenderCachedComponent extends AbstractOrdrRenderComponent {
    @Import() declare private readonly ordrScoreRenderService: OrdrScoreRenderService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { action, sessionID } = ctx.params as {
            action?: "show" | "rerender";
            sessionID?: string;
        };

        if (!action || !sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = await this.getData(ctx, sessionID);

        if (data.stage !== EOrdrRenderStage.Cached) {
            throw new Exception(EApplicationError.INPUT_ERROR, "This cached render prompt is no longer active.");
        }

        await ctx.deferUpdate();

        switch (action) {
            case "show":
                await this.show(ctx, data);
                return;
            case "rerender":
                await this.rerender(ctx, sessionID, data);
                return;
        }
    }

    private async show(ctx: ComponentContext, data: OrdrRenderViewDto): Promise<void> {
        if (!data.cachedVideoURL) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "The cached render is missing its video URL.");
        }

        await ctx.sendChannelMessage({
            content: `<@${data.authorID}> ${data.cachedVideoURL}`,
            allowedMentions: {
                users: [data.authorID],
            },
        });

        await ctx.deleteSourceMessage();
    }

    private async rerender(ctx: ComponentContext, sessionID: string, data: OrdrRenderViewDto): Promise<void> {
        if (!data.scoreID) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "The render session is missing its score ID.");
        }

        try {
            data.score = await this.ordrScoreRenderService.resolve(data.scoreID);

            data.forceRerender = true;
            data.stage = EOrdrRenderStage.Confirmation;
            data.notice = undefined;
        } catch (error) {
            data.notice = this.errorMessage(error);
        }

        await this.persistAndEdit(ctx, sessionID, data);
    }
}

@Button(/^ordr_render_action:(?<action>render|cancel):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OrdrRenderActionComponent extends AbstractOrdrRenderComponent {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly ordrService: OrdrService;
    @Import() declare private readonly ordrRenderService: OrdrRenderService;
    @Import() declare private readonly ordrScoreRenderService: OrdrScoreRenderService;

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
            await ctx.deleteSourceMessage();
            return;
        }

        let scoreLock: string | null = null;

        if (data.input === EOrdrRenderInput.Score) {
            scoreLock = await this.prepareScoreSubmission(ctx, sessionID, data);

            if (!scoreLock) {
                return;
            }
        }

        const created = await this.submit(ctx, sessionID, data);
        if (!created) {
            if (scoreLock && data.scoreID) {
                await this.releaseScoreLock(
                    data.scoreID,
                    scoreLock,
                    "Failed to release score render lock after failed submission",
                );
            }

            return;
        }

        data.renderID = created.renderID;
        data.stage = EOrdrRenderStage.Queued;
        data.progress = "Waiting in render queue";
        data.notice = undefined;

        await this.persistAndEdit(ctx, sessionID, data).catch((error) => {
            this.logger.warn({ error, renderID: created.renderID }, "Failed to show accepted o!rdr render");
        });

        void this.track(ctx, sessionID, data, scoreLock).catch((error) => {
            this.logger.error({ error, renderID: created.renderID }, "Unhandled o!rdr render tracking error");
        });
    }

    private async prepareScoreSubmission(
        ctx: ComponentContext,
        sessionID: string,
        data: OrdrRenderViewDto,
    ): Promise<string | null> {
        if (!data.scoreID) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "Score render is missing its score ID.");
        }

        const scoreID = data.scoreID;
        const lock = await this.ordrScoreRenderService.acquireLock(scoreID);

        if (!lock) {
            data.stage = EOrdrRenderStage.AlreadyRendering;
            data.notice = undefined;

            await this.persistAndEdit(ctx, sessionID, data);

            return null;
        }

        try {
            if (!data.forceRerender) {
                const cached = await this.ordrScoreRenderService.cached(scoreID);

                if (cached) {
                    await this.ordrScoreRenderService.releaseLock(scoreID, lock);

                    data.stage = EOrdrRenderStage.Cached;
                    data.cachedRenderID = cached.renderID;
                    data.cachedVideoURL = cached.videoURL;
                    data.notice = undefined;

                    await this.persistAndEdit(ctx, sessionID, data);

                    return null;
                }
            }

            return lock;
        } catch (error) {
            await this.releaseScoreLock(
                scoreID,
                lock,
                "Failed to release score render lock while preparing submission",
            );

            throw error;
        }
    }

    private async submit(
        ctx: ComponentContext,
        sessionID: string,
        data: OrdrRenderViewDto,
    ): Promise<OrdrRenderCreateDto | null> {
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

                const created = await this.createRender(data);
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

    private async createRender(data: OrdrRenderViewDto): Promise<OrdrRenderCreateDto> {
        switch (data.input) {
            case EOrdrRenderInput.Score:
                return this.createScoreRender(data);
            case EOrdrRenderInput.Replay:
            default:
                return this.createReplayRender(data);
        }
    }

    private async createScoreRender(data: OrdrRenderViewDto): Promise<OrdrRenderCreateDto> {
        if (!data.scoreID || !data.score) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "Score render is missing score information.");
        }

        const replay = await this.osuService.replay(data.scoreID);
        return this.ordrService.renderBytes(data.authorID, `${data.scoreID}.osr`, replay, data.config);
    }

    private async createReplayRender(data: OrdrRenderViewDto): Promise<OrdrRenderCreateDto> {
        if (!data.replay) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "Replay render is missing its replay attachment.");
        }

        return this.ordrService.render(data.authorID, data.replay, data.config);
    }

    private async track(
        ctx: ComponentContext,
        sessionID: string,
        data: OrdrRenderViewDto,
        scoreLock: string | null,
    ): Promise<void> {
        if (data.renderID === undefined) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "Cannot track a render without a render ID.");
        }

        const renderID = data.renderID;
        let reachedTerminal = false;

        const updater = new ThrottledAsyncUpdater<OrdrRenderViewDto>(
            async (snapshot) => {
                await this.persistAndEdit(ctx, sessionID, snapshot);
            },
            4_000,
            (error) => {
                this.logger.warn({ error, renderID }, "Failed to update o!rdr progress message");
            },
        );

        try {
            const terminal = await this.ordrService.waitForRender(renderID, (event) => {
                this.applyEvent(data, event);

                if (event.type !== "done" && event.type !== "failed") {
                    updater.push(this.cloneView(data));
                }
            });

            reachedTerminal = true;
            await updater.close(false);

            this.applyTerminalEvent(data, terminal);

            if (terminal.type === "done" && data.input === EOrdrRenderInput.Score && data.scoreID) {
                await this.ordrScoreRenderService
                    .record(data.scoreID, renderID, terminal.data.videoUrl)
                    .catch((error) => {
                        this.logger.error(
                            { error, scoreID: data.scoreID, renderID },
                            "Failed to cache completed score render",
                        );
                    });
            }

            await this.persistAndEdit(ctx, sessionID, data).catch((error) => {
                this.logger.warn({ error, renderID }, "Failed to display final o!rdr render state");
            });

            if (terminal.type === "done") {
                await ctx
                    .sendChannelMessage({
                        content: `<@${data.authorID}> ${terminal.data.videoUrl}`,
                        allowedMentions: {
                            users: [data.authorID],
                        },
                    })
                    .catch((error) => {
                        this.logger.warn({ error, renderID }, "Failed to send completed o!rdr render URL");
                    });
            }
        } catch (error) {
            await updater.close(false);

            data.stage = EOrdrRenderStage.Failed;
            data.errorMessage = this.errorMessage(error);

            await this.persistAndEdit(ctx, sessionID, data).catch((editError) => {
                this.logger.warn({ error: editError, renderID }, "Failed to display o!rdr tracking error");
            });
        } finally {
            if (reachedTerminal && scoreLock && data.scoreID) {
                await this.releaseScoreLock(data.scoreID, scoreLock, "Failed to release completed score render lock");
            }
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

    private cloneView(data: OrdrRenderViewDto): OrdrRenderViewDto {
        return plainToInstance(OrdrRenderViewDto, structuredClone(data));
    }

    private async releaseScoreLock(scoreID: string, token: string, logMessage: string): Promise<void> {
        await this.ordrScoreRenderService.releaseLock(scoreID, token).catch((error) => {
            this.logger.warn({ error, scoreID }, logMessage);
        });
    }
}
