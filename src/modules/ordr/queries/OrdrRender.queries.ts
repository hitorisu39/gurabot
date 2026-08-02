import { EOrdrConfigSource, OrdrConfigDto } from "@domain/ordr/OrdrConfig.dto";
import type { Prisma } from "@generated/prisma/client";

export const getLatestOrdrRenderQuery = (userID: string, after: Date) => {
    return {
        where: {
            userID,
            createdAt: {
                gte: after,
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    } satisfies Prisma.OrdrRenderFindFirstArgs;
};

export const getRecentOrdrSkinsQuery = (userID: string) => {
    return {
        where: {
            userID,
            skin: {
                not: null,
            },
        },
        orderBy: {
            createdAt: "desc",
        },
        take: 30,
        select: {
            skin: true,
            customSkin: true,
        },
    } satisfies Prisma.OrdrRenderFindManyArgs;
};

export const getCreateOrdrRenderQuery = (userID: string, renderID: number, config: OrdrConfigDto) => {
    const usesBotSettings = config.source === EOrdrConfigSource.Bot;

    return {
        data: {
            userID,
            renderID,
            source: config.source,
            skin: usesBotSettings ? config.settings.skin : null,
            customSkin: usesBotSettings ? config.settings.customSkin : null,
        },
    } satisfies Prisma.OrdrRenderCreateArgs;
};
