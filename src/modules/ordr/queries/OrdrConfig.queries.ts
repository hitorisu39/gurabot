import { EOrdrConfigSource, OrdrSettingsDto } from "@domain/ordr/OrdrConfig.dto";
import { instanceToPlain } from "class-transformer";

import type { Prisma } from "@generated/prisma/client";

const serializeOrdrSettings = (settings: OrdrSettingsDto): Prisma.InputJsonObject => {
    return instanceToPlain(settings, {
        exposeUnsetFields: false,
    }) as Prisma.InputJsonObject;
};

export const getOrCreateOrdrUserQuery = (userID: string) => {
    return {
        where: { id: userID },
        create: { id: userID },
        update: {},
    } satisfies Prisma.UserUpsertArgs;
};

export const getOrCreateOrdrConfigQuery = (userID: string, settings: OrdrSettingsDto) => {
    return {
        where: { userID },
        create: {
            userID,
            source: EOrdrConfigSource.Bot,
            settings: serializeOrdrSettings(settings),
        },
        update: {},
    } satisfies Prisma.OrdrConfigUpsertArgs;
};

export const getSaveOrdrConfigQuery = (userID: string, source: EOrdrConfigSource, settings: OrdrSettingsDto) => {
    const serialized = serializeOrdrSettings(settings);

    return {
        where: { userID },
        create: {
            userID,
            source,
            settings: serialized,
        },
        update: {
            source,
            settings: serialized,
        },
    } satisfies Prisma.OrdrConfigUpsertArgs;
};
