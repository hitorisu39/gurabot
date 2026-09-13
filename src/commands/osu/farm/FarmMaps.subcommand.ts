import { Category, Command, Subcommand } from "@/core/decorators";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";
import { AbstractFarmMapsCommand } from "./AbstractFarmMapsCommand";

@Subcommand({
    root: "farm",
    name: "maps",
    description: "Browses farm maps from the osu!pps dataset.",
})
export class FarmMapsSubcommand extends AbstractFarmMapsCommand {}

@Command({
    name: "farmmaps",
    description: "Browses farm maps from the osu!pps dataset.",
    aliases: ["fmaps"],
    prefixOnly: true,
})
export class FarmMapsCommand extends AbstractFarmMapsCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikofarmmaps",
    description: "Browses osu!taiko farm maps.",
    aliases: ["tfmaps"],
    prefixOnly: true,
})
export class TaikoFarmMapsCommand extends AbstractFarmMapsCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchfarmmaps",
    description: "Browses osu!catch farm maps.",
    aliases: ["cfmaps"],
    prefixOnly: true,
})
export class CatchFarmMapsCommand extends AbstractFarmMapsCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniafarmmaps",
    description: "Browses osu!mania farm maps.",
    aliases: ["mfmaps"],
    prefixOnly: true,
})
export class ManiaFarmMapsCommand extends AbstractFarmMapsCommand {
    protected forcedMode = GameMode.Mania;
}
