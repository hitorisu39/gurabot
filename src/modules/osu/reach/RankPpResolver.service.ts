import { Import, Trace } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { OsuService } from "@/modules/osu/Osu.service";
import { OsuDailyService } from "@/modules/osudaily/OsuDaily.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ERankPpResolutionSource } from "@domain/osu/enums/Reach.enum";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { RankPpResolutionDto } from "@domain/osu/Reach.dto";
import { AdapterProvider, GameMode, RankingType } from "@generated/adapter/types";

export class RankPpResolverService extends AbstractService {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly osuDailyService: OsuDailyService;

    private readonly rankingMaxRank = 10_000;
    private readonly rankingPageSize = 50;

    @Trace()
    public async resolve(
        rank: number,
        mode: GameMode,
        provider: AdapterProvider,
        countryCode?: string,
    ): Promise<RankPpResolutionDto> {
        if (provider !== AdapterProvider.Bancho) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Rank targets are only available on Bancho.");
        }

        if (rank <= this.rankingMaxRank) {
            const response = await this.fromRankingApi(rank, mode, provider, countryCode).catch(() => null);

            if (response) return response;
        }

        if (countryCode) {
            throw new Exception(
                EApplicationError.INPUT_ERROR,
                `Country ranks above ${ProfileFormatter.rank(this.rankingMaxRank)} cannot currently be resolved.`,
            );
        }

        const pp = await this.osuDailyService.ppByRank(rank, mode, provider);
        return {
            rank,
            pp,
            source: ERankPpResolutionSource.OsuDaily,
        };
    }

    private async fromRankingApi(
        rank: number,
        mode: GameMode,
        provider: AdapterProvider,
        countryCode?: string,
    ): Promise<RankPpResolutionDto | null> {
        const page = Math.ceil(rank / this.rankingPageSize);

        const rankings = await this.osuService.rankings(
            mode,
            RankingType.Performance,
            {
                country: countryCode,
                page,
            },
            provider,
        );

        if (!rankings.length) {
            return null;
        }

        const entry = countryCode
            ? rankings.find((entry) => entry.countryRank === rank)
            : rankings.find((entry) => entry.globalRank === rank);

        const fallbackIndex = (rank - 1) % this.rankingPageSize;
        const resolved = entry ?? rankings[fallbackIndex];

        if (!resolved || !Number.isFinite(resolved.pp)) {
            return null;
        }

        return {
            rank,
            countryCode,
            pp: resolved.pp,
            source: ERankPpResolutionSource.Ranking,
            holder: {
                id: resolved.user.id,
                username: resolved.user.username,
            },
        };
    }
}
