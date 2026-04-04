import { TRepository } from "@/core";
import { AbstractService } from "@/core/framework/AbstractService";
import { MatchedMapDto } from "@domain/osu/Beatmap.dto";

export class ChannelService extends AbstractService {
    public async storeBeatmap(channelID: string, data: MatchedMapDto, repository?: TRepository): Promise<void> {
        const cb = async (repo: TRepository) => {
            await repo.channel.upsert({
                where: { id: channelID },
                update: {
                    beatmapID: data.beatmapID ?? null,
                    beatmapsetID: data.beatmapsetID ?? null,
                },
                create: {
                    id: channelID,
                    beatmapID: data.beatmapID ?? null,
                    beatmapsetID: data.beatmapsetID ?? null,
                },
            });
        };

        return repository ? cb(repository) : this.repository.$transaction(cb);
    }

    public async getBeatmap(channelID: string, repository?: TRepository): Promise<MatchedMapDto | null> {
        const cb = async (repo: TRepository) => {
            const channel = await repo.channel.findUnique({ where: { id: channelID } });

            if (!channel || (!channel.beatmapID && !channel.beatmapsetID)) {
                return null;
            }

            return {
                beatmapID: channel.beatmapID,
                beatmapsetID: channel.beatmapsetID,
            };
        };

        return cb(repository ?? this.repository);
    }
}
