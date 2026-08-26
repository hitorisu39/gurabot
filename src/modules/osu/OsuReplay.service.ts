import { Import } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { OsuScoreService } from "@/modules/osu/OsuScore.service";
import { wait } from "@domain/utils";
import { AdapterProvider } from "@generated/adapter/types";

export class OsuReplayService extends AbstractService {
    @Import() declare private readonly scoreService: OsuScoreService;

    /**
     * osu! allows 10 replay downloads/minute.
     *
     * A 6.1 second minimum start interval gives us slightly less than
     * 10/min globally without minute-boundary bursts.
     */
    private readonly interval = 6_100;

    /**
     * Avoid duplicate requests for the same replay within this process.
     */
    private readonly activeDownloads = new Map<string, Promise<Uint8Array>>();

    public async replay(id: string | number, provider: AdapterProvider = AdapterProvider.Bancho): Promise<Uint8Array> {
        const key = `${provider}:${id}`;

        const active = this.activeDownloads.get(key);

        if (active) {
            return active;
        }

        const task = this.download(id, provider);
        this.activeDownloads.set(key, task);

        try {
            return await task;
        } finally {
            this.activeDownloads.delete(key);
        }
    }

    private async download(id: string | number, provider: AdapterProvider): Promise<Uint8Array> {
        if (provider === AdapterProvider.Bancho) {
            await this.waitForBanchoSlot();
        }

        return this.adapter[provider].replay({ id: String(id) });
    }

    private async waitForBanchoSlot(): Promise<void> {
        while (true) {
            const acquired = await this.cache.reserveLease("osu:replay-download", this.interval);
            if (acquired) {
                return;
            }

            await wait(250);
        }
    }
}
