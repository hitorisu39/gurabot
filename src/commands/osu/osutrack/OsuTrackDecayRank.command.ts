import { Category, Command, Subcommand } from "@/core/decorators";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";
import { AbstractOsuTrackDecayRankCommand } from "./AbstractOsuTrackDecayRankCommand";

@Subcommand({
    root: "osutrack",
    group: "decay",
    name: "rank",
    description: "Estimates how long it takes to naturally decay to a target rank.",
})
export class OsuTrackDecayRankSubcommand extends AbstractOsuTrackDecayRankCommand {}

@Command({
    name: "osutrackdecayrank",
    description: "Estimates how long it takes to naturally decay to a target rank.",
    aliases: ["otdr", "decay"],
    prefixOnly: true,
})
export class OsuTrackDecayRankCommand extends AbstractOsuTrackDecayRankCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikoosutrackdecayrank",
    description: "Estimates how long it takes to naturally decay to an osu!taiko rank.",
    aliases: ["totdr"],
    prefixOnly: true,
})
export class TaikoOsuTrackDecayRankCommand extends AbstractOsuTrackDecayRankCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchosutrackdecayrank",
    description: "Estimates how long it takes to naturally decay to an osu!catch rank.",
    aliases: ["cotdr"],
    prefixOnly: true,
})
export class CatchOsuTrackDecayRankCommand extends AbstractOsuTrackDecayRankCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniaosutrackdecayrank",
    description: "Estimates how long it takes to naturally decay to an osu!mania rank.",
    aliases: ["motdr"],
    prefixOnly: true,
})
export class ManiaOsuTrackDecayRankCommand extends AbstractOsuTrackDecayRankCommand {
    protected forcedMode = GameMode.Mania;
}
