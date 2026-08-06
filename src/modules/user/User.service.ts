import { AbstractService } from "@/core/framework/AbstractService";
import { AdapterProvider } from "@generated/adapter/types";
import { UserConfigUpdateDto, UserDto, UserToOsuDto } from "@domain/user/User.dto";
import { plainToInstance } from "class-transformer";
import { TRepository } from "@/core";

export class UserService extends AbstractService {
    public async link(
        userID: string,
        osuID: number,
        provider: AdapterProvider = AdapterProvider.Bancho,
        repository?: TRepository,
    ): Promise<UserDto> {
        return this.linkMany(userID, osuID, [provider], repository);
    }

    public async linkMany(
        userID: string,
        osuID: number,
        providers: ReadonlyArray<AdapterProvider>,
        repository?: TRepository,
    ): Promise<UserDto> {
        const cb = async (repo: TRepository): Promise<UserDto> => {
            await repo.user.upsert({
                where: {
                    id: userID,
                },
                create: {
                    id: userID,
                },
                update: {},
            });

            const uniqueProviders = [...new Set(providers)];

            for (const provider of uniqueProviders) {
                await repo.userToOsu.upsert({
                    where: {
                        userID_server: {
                            userID,
                            server: provider,
                        },
                    },
                    create: {
                        userID,
                        server: provider,
                        osuID,
                    },
                    update: {
                        osuID,
                    },
                });
            }

            const user = await repo.user.findUniqueOrThrow({
                where: {
                    id: userID,
                },
            });

            return plainToInstance(UserDto, user);
        };

        return repository ? cb(repository) : this.repository.$transaction<UserDto>(cb);
    }

    public async unlink(userID: string, provider?: AdapterProvider | null, repository?: TRepository): Promise<void> {
        const cb = async (repo: TRepository) => {
            if (provider) {
                await repo.userToOsu.delete({
                    where: {
                        userID_server: {
                            userID: userID,
                            server: provider,
                        },
                    },
                });
            } else {
                await repo.user.delete({ where: { id: userID } });
            }
        };

        return repository ? cb(repository) : this.repository.$transaction(cb);
    }

    public async unlinkMany(
        userID: string,
        providers: ReadonlyArray<AdapterProvider>,
        repository?: TRepository,
    ): Promise<void> {
        const cb = async (repo: TRepository): Promise<void> => {
            const uniqueProviders = [...new Set(providers)];

            await repo.userToOsu.deleteMany({
                where: {
                    userID,
                    server: {
                        in: uniqueProviders,
                    },
                },
            });
        };

        return repository ? cb(repository) : this.repository.$transaction(cb);
    }

    public async get(userID: string, repository?: TRepository): Promise<UserDto | null> {
        const cb = async (repo: TRepository) => {
            const user = await repo.user.findUnique({ where: { id: userID } });
            return plainToInstance(UserDto, user);
        };

        return cb(repository ?? this.repository);
    }

    public async getLinked(userID: string, repository?: TRepository): Promise<UserDto | null> {
        const cb = async (repo: TRepository) => {
            const user = await repo.user.findUnique({ where: { id: userID }, include: { linked: true } });
            return plainToInstance(UserDto, user);
        };

        return cb(repository ?? this.repository);
    }

    public async getLinkedID(
        userID: string,
        provider: AdapterProvider,
        repository?: TRepository,
    ): Promise<UserToOsuDto | null> {
        const cb = async (repo: TRepository) => {
            const data = await repo.userToOsu.findUnique({
                where: { userID_server: { userID: userID, server: provider } },
            });
            return plainToInstance(UserToOsuDto, data);
        };

        return cb(repository ?? this.repository);
    }

    public async update(userID: string, updates: UserConfigUpdateDto, repository?: TRepository): Promise<UserDto> {
        const cb = async (repo: TRepository) => {
            const user = await repo.user.update({
                where: { id: userID },
                data: { ...updates },
            });

            return plainToInstance(UserDto, user);
        };

        return repository ? cb(repository) : this.repository.$transaction(cb);
    }
}
