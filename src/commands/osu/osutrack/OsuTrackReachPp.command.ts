import { Category, Command, Subcommand } from "@/core/decorators";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";
import { AbstractOsuTrackReachPpCommand } from "./AbstractOsuTrackReachPpCommand";

@Subcommand({
    root: "osutrack",
    group: "reach",
    name: "pp",
    description: "Estimates how long it may take to reach a PP milestone.",
})
export class OsuTrackReachPpSubcommand extends AbstractOsuTrackReachPpCommand {}

@Command({
    name: "osutrackreachpp",
    description: "Estimates how long it may take to reach a PP milestone.",
    aliases: ["otrp"],
    prefixOnly: true,
})
export class OsuTrackReachPpCommand extends AbstractOsuTrackReachPpCommand {}

// Taiko
@Category(ECommandCategory.Taiko)
@Command({
    name: "taikoosutrackreachpp",
    description: "Estimates how long it may take to reach an osu!taiko PP milestone.",
    aliases: ["totrp"],
    prefixOnly: true,
})
export class TaikoOsuTrackReachPpCommand extends AbstractOsuTrackReachPpCommand {
    protected forcedMode = GameMode.Taiko;
}

// Catch
@Category(ECommandCategory.Catch)
@Command({
    name: "catchosutrackreachpp",
    description: "Estimates how long it may take to reach an osu!catch PP milestone.",
    aliases: ["cotrp"],
    prefixOnly: true,
})
export class CatchOsuTrackReachPpCommand extends AbstractOsuTrackReachPpCommand {
    protected forcedMode = GameMode.Catch;
}

// Mania
@Category(ECommandCategory.Mania)
@Command({
    name: "maniaosutrackreachpp",
    description: "Estimates how long it may take to reach an osu!mania PP milestone.",
    aliases: ["motrp"],
    prefixOnly: true,
})
export class ManiaOsuTrackReachPpCommand extends AbstractOsuTrackReachPpCommand {
    protected forcedMode = GameMode.Mania;
}
