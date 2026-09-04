import { describe, expect, test } from "vitest";
import { core } from "@generated/core/index.js";
import {
    CatchProfileCommand,
    ManiaProfileCommand,
    ProfileCommand,
    TaikoProfileCommand,
} from "@/commands/osu/profile/Profile.command";
import { OsuService } from "@/modules/osu/Osu.service";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { OsuTrackService } from "@/modules/osutrack/OsuTrack.service";

function getImports(target: unknown) {
    return core.imports.filter((entry) => entry.target === target);
}

describe("Core generation", () => {
    describe("inherited @Import()", () => {
        const profileCommands = [
            ProfileCommand,
            TaikoProfileCommand,
            CatchProfileCommand,
            ManiaProfileCommand,
        ] as const;

        test.each(profileCommands.map((CommandType) => [CommandType.name, CommandType] as const))(
            "%s inherits AbstractProfileCommand dependencies",
            (_, CommandType) => {
                const imports = getImports(CommandType);

                expect(imports).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({
                            target: CommandType,
                            dependency: OsuService,
                            propertyKey: "osuService",
                        }),
                        expect.objectContaining({
                            target: CommandType,
                            dependency: ProfileViewService,
                            propertyKey: "profileViewService",
                        }),
                        expect.objectContaining({
                            target: CommandType,
                            dependency: OsuTrackService,
                            propertyKey: "osuTrackService",
                        }),
                    ]),
                );
            },
        );

        test.each(profileCommands.map((CommandType) => [CommandType.name, CommandType] as const))(
            "%s generates each inherited dependency only once",
            (_, CommandType) => {
                const imports = getImports(CommandType);
                const expected = [
                    {
                        dependency: OsuService,
                        propertyKey: "osuService",
                    },
                    {
                        dependency: ProfileViewService,
                        propertyKey: "profileViewService",
                    },
                    {
                        dependency: OsuTrackService,
                        propertyKey: "osuTrackService",
                    },
                ] as const;

                for (const entry of expected) {
                    const matches = imports.filter(
                        (candidate) =>
                            candidate.dependency === entry.dependency && candidate.propertyKey === entry.propertyKey,
                    );

                    expect(matches, `${CommandType.name}.${entry.propertyKey}`).toHaveLength(1);
                }
            },
        );
    });

    describe("inherited @On()", () => {
        test("does not generate duplicate dispatcher bindings", () => {
            const seen = new Set<string>();

            for (const handler of core.dispatchHandlers) {
                const key = [handler.target.name, handler.domain, handler.event, handler.propertyKey].join(":");
                expect(seen.has(key), `Duplicate generated dispatcher binding: ${key}`).toBe(false);
                seen.add(key);
            }
        });
    });
});
