import { Trace } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { HttpClient } from "@/http";
import { SocketClient } from "@/socket";
import { EApplicationError, Exception } from "@domain/core/Exception";
import {
    OrdrCustomSkinDto,
    OrdrOfficialSkinDto,
    OrdrOfficialSkinLookupDto,
    OrdrOfficialSkinsDto,
    OrdrPresetDto,
    OrdrRenderAddedDto,
    OrdrRenderCreateDto,
    OrdrRenderDoneDto,
    OrdrRenderFailedDto,
    OrdrRenderLookupDto,
    OrdrRenderProgressDto,
    OrdrReplayFileDto,
    TOrdrRenderEvent,
    TOrdrRenderTerminalEvent,
} from "@domain/ordr/Ordr.dto";
import { EOrdrConfigSource, OrdrConfigDto, OrdrSettingsDto } from "@domain/ordr/OrdrConfig.dto";
import { basename } from "node:path";
import { plainToInstance } from "class-transformer";
import { discordRegexAnyNumber } from "@domain/discord/configs/Discord.config";

type TOrdrServerEvents = {
    render_added_json(data: unknown): void;
    render_progress_json(data: unknown): void;
    render_done_json(data: unknown): void;
    render_failed_json(data: unknown): void;
};

interface IBufferedRenderEvent {
    event: TOrdrRenderEvent;
    receivedAt: number;
}

export class OrdrService extends AbstractService {
    declare private http: HttpClient;
    declare private replayHttp: HttpClient;
    declare private socket: SocketClient<TOrdrServerEvents>;

    private readonly name = "o!rdr";
    private readonly base = "https://apis.issou.best";
    private readonly timeout = 5_000;
    private readonly replayTimeout = 20_000;
    private readonly renderTimeout = 30 * 60 * 1_000;

    private readonly eventBufferTtl = 30_000;
    private readonly maxBufferedRenderIDs = 500;
    private readonly maxBufferedEventsPerRender = 20;

    private readonly listeners = new Map<number, Set<(event: TOrdrRenderEvent) => void>>();
    private readonly bufferedEvents = new Map<number, Array<IBufferedRenderEvent>>();

    public async init(): Promise<void> {
        this.http = new HttpClient(this.logger, {
            name: this.name,
            baseURL: this.base,
            timeout: this.timeout,
        });

        this.replayHttp = new HttpClient(this.logger, {
            name: `${this.name}:Replay`,
            timeout: this.replayTimeout,
        });

        this.socket = new SocketClient(this.logger, {
            name: this.name,
            url: this.base,
            path: "/ordr/ws",
            transports: ["websocket"],
        });

        this.socket
            .on("render_added_json", (data) => this.onRenderAdded(data))
            .on("render_progress_json", (data) => this.onRenderProgress(data))
            .on("render_done_json", (data) => this.onRenderDone(data))
            .on("render_failed_json", (data) => this.onRenderFailed(data));

        await this.socket.connect();
    }

    @Trace()
    public async preset(discordID: string): Promise<OrdrPresetDto | null> {
        const response = await this.http.getResponse<OrdrPresetDto>("/ordr/presets/bot", {
            params: {
                key: this.config.ordr.verificationKey,
                discord_id: discordID,
            },
            validateStatus: (status) => status === 200 || status === 404,
        });

        if (response.status === 404) return null;
        return response.data;
    }

    @Trace()
    public async customSkin(id: number): Promise<OrdrCustomSkinDto | null> {
        const response = await this.http.getResponse<OrdrCustomSkinDto>("/ordr/skins/custom", {
            params: { id },
            validateStatus: (status) => status === 200 || status === 404,
        });

        if (response.status === 404) return null;
        const data = response.data;

        if (data.found !== true || data.removed === true) return null;
        return data;
    }

    @Trace()
    public async render(
        discordUserID: string,
        replay: OrdrReplayFileDto,
        config: OrdrConfigDto,
    ): Promise<OrdrRenderCreateDto> {
        const [, replayFile] = await Promise.all([this.socket.connect(), this.downloadReplay(replay)]);
        return this.submitRender(discordUserID, replay.name, replayFile, config);
    }

    @Trace()
    public async renderBytes(
        discordUserID: string,
        filename: string,
        bytes: Uint8Array,
        config: OrdrConfigDto,
    ): Promise<OrdrRenderCreateDto> {
        await this.socket.connect();

        if (!bytes.byteLength) {
            throw new Exception(EApplicationError.INPUT_ERROR, "The score replay is empty.");
        }

        const replayFile = new Blob([Uint8Array.from(bytes)], { type: "application/octet-stream" });
        return this.submitRender(discordUserID, filename, replayFile, config);
    }

    private async submitRender(
        discordUserID: string,
        filename: string,
        replayFile: Blob,
        config: OrdrConfigDto,
    ): Promise<OrdrRenderCreateDto> {
        const form = this.buildRenderForm(discordUserID, filename, replayFile, config);
        const response = await this.http.postResponse<OrdrRenderCreateDto>("/ordr/renders", form, {
            validateStatus: (status) => status >= 200 && status < 600,
        });

        const data = response.data;

        if (response.status >= 400 || (data.errorCode && data.errorCode !== 0)) {
            const errorMessage = data.message ?? `${this.name} rejected the render request.`;

            const errorSuffix = !data.errorCode ? "" : ` (o!rdr error ${data.errorCode})`;

            this.logger.warn(
                {
                    status: response.status,
                    errorCode: data.errorCode,
                    message: data.message,
                },
                "o!rdr rejected render request",
            );

            throw new Exception(EApplicationError.INPUT_ERROR, `${errorMessage}${errorSuffix}`);
        }

        if (!data.renderID) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} did not return a render ID.`);
        }

        return plainToInstance(OrdrRenderCreateDto, data);
    }

    @Trace()
    public async officialSkins(search?: string, pageSize: number = 5, page: number = 1): Promise<OrdrOfficialSkinsDto> {
        return await this.http.get<OrdrOfficialSkinsDto>("/ordr/skins", {
            params: {
                search: search?.trim() || undefined,
                pageSize,
                page,
            },
        });
    }

    @Trace()
    public async lookupOfficialSkin(query: string, suggestionLimit: number = 5): Promise<OrdrOfficialSkinLookupDto> {
        const input = query.trim();

        if (!input) {
            return {
                match: null,
                suggestions: [],
            };
        }

        const result = await this.officialSkins(input, Math.max(20, suggestionLimit));
        let match = this.matchOfficialSkin(result.skins, input);

        if (!match && discordRegexAnyNumber.test(input)) {
            match = await this.officialSkinByID(Number(input));
        }

        return {
            match,
            suggestions: result.skins.slice(0, suggestionLimit),
        };
    }

    @Trace()
    public async mapsetIDFromLink(link: string): Promise<number | null> {
        const response = await this.http.get<OrdrRenderLookupDto>("/ordr/renders", {
            params: { link, pageSize: 1 },
        });

        const data = plainToInstance(OrdrRenderLookupDto, response);
        return data.renders?.[0]?.mapID ?? null;
    }

    public async officialSkin(query: string): Promise<OrdrOfficialSkinDto | null> {
        return (await this.lookupOfficialSkin(query, 0)).match;
    }

    private async officialSkinByID(id: number): Promise<OrdrOfficialSkinDto | null> {
        const pageSize = 100;
        let page = 1;

        while (true) {
            const result = await this.officialSkins(undefined, pageSize, page);
            const match = result.skins.find((skin) => skin.id === id);

            if (match) return match;
            if (page * pageSize >= result.maxSkins) return null;

            page++;
        }
    }

    private matchOfficialSkin(skins: Array<OrdrOfficialSkinDto>, query: string): OrdrOfficialSkinDto | null {
        const input = query.trim().toLocaleLowerCase();
        const numericID = discordRegexAnyNumber.test(input) ? Number(input) : null;

        const exact = skins.find((skin) => {
            return (
                skin.skin.toLocaleLowerCase() === input ||
                skin.presentationName.toLocaleLowerCase() === input ||
                (numericID !== null && skin.id === numericID)
            );
        });

        if (exact) return exact;

        const normalized = this.normalizeOfficialSkinName(query);

        return (
            skins.find((skin) => {
                return (
                    this.normalizeOfficialSkinName(skin.skin) === normalized ||
                    this.normalizeOfficialSkinName(skin.presentationName) === normalized
                );
            }) ?? null
        );
    }

    private normalizeOfficialSkinName(value: string): string {
        return value
            .normalize("NFKC")
            .toLocaleLowerCase()
            .replace(/[^\p{L}\p{N}]+/gu, "");
    }

    public async waitForRender(
        renderID: number,
        onEvent: (event: TOrdrRenderEvent) => void,
        timeout: number = this.renderTimeout,
    ): Promise<TOrdrRenderTerminalEvent> {
        await this.socket.connect();

        return new Promise<TOrdrRenderTerminalEvent>((resolve, reject) => {
            let settled = false;

            const cleanup = (): void => {
                const listeners = this.listeners.get(renderID);

                listeners?.delete(listener);
                if (!listeners?.size) this.listeners.delete(renderID);

                clearTimeout(timer);
            };

            const listener = (event: TOrdrRenderEvent): void => {
                if (settled) return;

                try {
                    onEvent(event);
                } catch (error) {
                    this.logger.warn({ error, renderID }, "o!rdr render event callback failed");
                }

                if (event.type === "done" || event.type === "failed") {
                    settled = true;
                    cleanup();
                    resolve(event);
                }
            };

            const timer = setTimeout(() => {
                if (settled) return;

                settled = true;
                cleanup();

                reject(
                    new Exception(
                        EApplicationError.INTERNAL_ERROR,
                        `Timed out while waiting for o!rdr render ${renderID}.`,
                    ),
                );
            }, timeout);

            const listeners = this.listeners.get(renderID) ?? new Set();
            listeners.add(listener);
            this.listeners.set(renderID, listeners);

            const buffered = this.bufferedEvents.get(renderID);

            if (buffered?.length) {
                this.bufferedEvents.delete(renderID);

                for (const item of buffered) {
                    listener(item.event);
                    if (settled) break;
                }
            }
        });
    }

    private buildRenderForm(
        discordUserID: string,
        replayName: string,
        replayFile: Blob,
        config: OrdrConfigDto,
    ): FormData {
        const form = new FormData();
        const filename = basename(replayName).slice(0, 128) || "replay.osr";

        form.append("replayFile", replayFile, filename);
        this.append(form, "verificationKey", this.config.ordr.verificationKey);

        if (config.source === EOrdrConfigSource.Preset) {
            this.append(form, "skin", config.settings.skin || this.config.ordr.defaultSkin);
            this.append(form, "resolution", config.settings.resolution);
            this.append(form, "discordUserId", discordUserID);
            return form;
        }

        this.appendSettings(form, config.settings);

        return form;
    }

    private appendSettings(form: FormData, settings: OrdrSettingsDto): void {
        this.append(form, "skin", settings.skin);
        this.append(form, "customSkin", settings.customSkin);
        this.append(form, "resolution", settings.resolution);
        this.append(form, "skip", settings.skip);
        this.append(form, "showResultScreen", settings.showResultScreen);

        this.append(form, "globalVolume", settings.globalVolume);
        this.append(form, "musicVolume", settings.musicVolume);
        this.append(form, "hitsoundVolume", settings.hitsoundVolume);
        this.append(form, "useSkinHitsounds", settings.useSkinHitsounds);
        this.append(form, "playNightcoreSamples", settings.playNightcoreSamples);

        this.append(form, "showHitErrorMeter", settings.showHitErrorMeter);
        this.append(form, "showUnstableRate", settings.showUnstableRate);
        this.append(form, "showScore", settings.showScore);
        this.append(form, "showHPBar", settings.showHPBar);
        this.append(form, "showComboCounter", settings.showComboCounter);
        this.append(form, "showPPCounter", settings.showPPCounter);
        this.append(form, "showScoreboard", settings.showScoreboard);
        this.append(form, "showAvatarsOnScoreboard", settings.showAvatarsOnScoreboard);
        this.append(form, "showBorders", settings.showBorders);
        this.append(form, "showMods", settings.showMods);
        this.append(form, "showAimErrorMeter", settings.showAimErrorMeter);
        this.append(form, "showHitCounter", settings.showHitCounter);
        this.append(form, "showKeyOverlay", settings.showKeyOverlay);
        this.append(form, "showStrainGraph", settings.showStrainGraph);
        this.append(form, "showSliderBreaks", settings.showSliderBreaks);

        this.append(form, "useSkinCursor", settings.useSkinCursor);
        this.append(form, "useSkinColors", settings.useSkinColors);
        this.append(form, "useBeatmapColors", settings.useBeatmapColors);
        this.append(form, "cursorSize", settings.cursorSize);
        this.append(form, "cursorTrail", settings.cursorTrail);
        this.append(form, "sliderSnakingIn", settings.sliderSnakingIn);
        this.append(form, "sliderSnakingOut", settings.sliderSnakingOut);
        this.append(form, "ignoreFail", settings.ignoreFail);

        this.append(form, "loadStoryboard", settings.loadStoryboard);
        this.append(form, "loadVideo", settings.loadVideo);
        this.append(form, "introBGDim", settings.introBGDim);
        this.append(form, "inGameBGDim", settings.inGameBGDim);
        this.append(form, "breakBGDim", settings.breakBGDim);
        this.append(form, "showDanserLogo", settings.showDanserLogo);
    }

    private async downloadReplay(replay: OrdrReplayFileDto): Promise<Blob> {
        const url = new URL(replay.url);

        if (!["cdn.discordapp.com", "media.discordapp.net"].includes(url.hostname)) {
            throw new Exception(EApplicationError.INPUT_ERROR, "The replay attachment has an invalid Discord CDN URL.");
        }

        const data = await this.replayHttp.get<ArrayBuffer>(replay.url, {
            responseType: "arraybuffer",
            timeout: this.replayTimeout,
        });

        const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
        if (!bytes.byteLength) {
            throw new Exception(EApplicationError.INPUT_ERROR, "The uploaded replay file could not be downloaded.");
        }

        return new Blob([bytes], {
            type: replay.contentType ?? "application/octet-stream",
        });
    }

    private onRenderAdded(data: unknown): void {
        this.publish({
            type: "added",
            data: plainToInstance(OrdrRenderAddedDto, data),
        });
    }

    private onRenderProgress(data: unknown): void {
        this.publish({
            type: "progress",
            data: plainToInstance(OrdrRenderProgressDto, data),
        });
    }

    private onRenderDone(data: unknown): void {
        this.publish({
            type: "done",
            data: plainToInstance(OrdrRenderDoneDto, data),
        });
    }

    private onRenderFailed(data: unknown): void {
        this.publish({
            type: "failed",
            data: plainToInstance(OrdrRenderFailedDto, data),
        });
    }

    private publish(event: TOrdrRenderEvent): void {
        this.pruneBufferedEvents();

        const renderID = event.data.renderID;
        const listeners = this.listeners.get(renderID);

        if (listeners?.size) {
            for (const listener of [...listeners]) listener(event);
            return;
        }

        const buffered = this.bufferedEvents.get(renderID) ?? [];

        buffered.push({
            event,
            receivedAt: Date.now(),
        });

        if (buffered.length > this.maxBufferedEventsPerRender) buffered.shift();

        this.bufferedEvents.set(renderID, buffered);

        while (this.bufferedEvents.size > this.maxBufferedRenderIDs) {
            const oldestRenderID = this.bufferedEvents.keys().next().value as number | undefined;
            if (oldestRenderID === undefined) break;

            this.bufferedEvents.delete(oldestRenderID);
        }
    }

    private pruneBufferedEvents(): void {
        const expiresBefore = Date.now() - this.eventBufferTtl;

        for (const [renderID, events] of this.bufferedEvents) {
            const retained = events.filter((item) => item.receivedAt >= expiresBefore);

            if (retained.length) {
                this.bufferedEvents.set(renderID, retained);
            } else {
                this.bufferedEvents.delete(renderID);
            }
        }
    }

    private append(form: FormData, key: string, value: string | number | boolean): void {
        form.append(key, typeof value === "boolean" ? value.toString().toLowerCase() : String(value));
    }
}
