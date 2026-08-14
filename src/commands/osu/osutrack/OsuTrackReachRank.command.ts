import { Category, Command, Subcommand } from "@/core/decorators";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";
import { AbstractOsuTrackReachRankCommand } from "./AbstractOsuTrackReachRankCommand";

@Subcommand({
    root: "osutrack",
    group: "reach",
    name: "rank",
    description: "Estimates how long it may take to reach a global rank milestone.",
})
export class OsuTrackReachRankSubcommand extends AbstractOsuTrackReachRankCommand {}

@Command({
    name: "osutrackreachrank",
    description: "Estimates how long it may take to reach a global rank milestone.",
    aliases: ["otrr"],
    prefixOnly: true,
})
export class OsuTrackReachRankCommand extends AbstractOsuTrackReachRankCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikoosutrackreachrank",
    description: "Estimates how long it may take to reach an osu!taiko rank milestone.",
    aliases: ["totrr"],
    prefixOnly: true,
})
export class TaikoOsuTrackReachRankCommand extends AbstractOsuTrackReachRankCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchosutrackreachrank",
    description: "Estimates how long it may take to reach an osu!catch rank milestone.",
    aliases: ["cotrr"],
    prefixOnly: true,
})
export class CatchOsuTrackReachRankCommand extends AbstractOsuTrackReachRankCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniaosutrackreachrank",
    description: "Estimates how long it may take to reach an osu!mania rank milestone.",
    aliases: ["motrr"],
    prefixOnly: true,
})
export class ManiaOsuTrackReachRankCommand extends AbstractOsuTrackReachRankCommand {
    protected forcedMode = GameMode.Mania;
}
