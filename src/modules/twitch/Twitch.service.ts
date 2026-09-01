import { TRepository } from "@/core";
import { AbstractService } from "@/core/framework/AbstractService";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { OsuToTwitchDto } from "@domain/twitch/Twitch.dto";
import { plainToInstance } from "class-transformer";

export class TwitchService extends AbstractService {
    public async link(osuID: number, twitchID: string, repository?: TRepository): Promise<OsuToTwitchDto> {
        const cb = async (repo: TRepository): Promise<OsuToTwitchDto> => {
            const existing = await repo.osuToTwitch.findUnique({ where: { twitchID } });
            if (existing && existing.osuID !== osuID) {
                throw new Exception(
                    EApplicationError.INPUT_ERROR,
                    "That Twitch account is already linked to another osu! account.",
                );
            }

            const link = await repo.osuToTwitch.upsert({
                where: {
                    osuID,
                },
                create: {
                    osuID,
                    twitchID,
                },
                update: {
                    twitchID,
                },
            });

            return plainToInstance(OsuToTwitchDto, link);
        };

        return repository ? cb(repository) : this.repository.$transaction(cb);
    }

    public async unlink(osuID: number, repository?: TRepository): Promise<boolean> {
        const cb = async (repo: TRepository): Promise<boolean> => {
            const result = await repo.osuToTwitch.deleteMany({ where: { osuID } });
            return result.count > 0;
        };

        return cb(repository ?? this.repository);
    }

    public async get(osuID: number, repository?: TRepository): Promise<OsuToTwitchDto | null> {
        const cb = async (repo: TRepository): Promise<OsuToTwitchDto | null> => {
            const link = await repo.osuToTwitch.findUnique({ where: { osuID } });
            return plainToInstance(OsuToTwitchDto, link);
        };

        return cb(repository ?? this.repository);
    }

    public async getByTwitchID(twitchID: string, repository?: TRepository): Promise<OsuToTwitchDto | null> {
        const cb = async (repo: TRepository): Promise<OsuToTwitchDto | null> => {
            const link = await repo.osuToTwitch.findUnique({ where: { twitchID } });
            return plainToInstance(OsuToTwitchDto, link);
        };

        return cb(repository ?? this.repository);
    }
}
