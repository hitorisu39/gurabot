import { Category, Command, Subcommand } from "@/core/decorators";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";
import { AbstractFarmRecommendCommand } from "./AbstractFarmRecommendCommand";

@Subcommand({
    root: "farm",
    name: "recommend",
    description: "Recommends farm maps based on a player's top plays.",
})
export class FarmRecommendSubcommand extends AbstractFarmRecommendCommand {}

@Command({
    name: "farmrecommend",
    description: "Recommends farm maps based on an osu! player's top plays.",
    aliases: ["recommend", "rec"],
    prefixOnly: true,
})
export class FarmRecommendCommand extends AbstractFarmRecommendCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikorecommend",
    description: "Recommends osu!taiko farm maps.",
    aliases: ["trec"],
    prefixOnly: true,
})
export class TaikoFarmRecommendCommand extends AbstractFarmRecommendCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchrecommend",
    description: "Recommends osu!catch farm maps.",
    aliases: ["crec"],
    prefixOnly: true,
})
export class CatchFarmRecommendCommand extends AbstractFarmRecommendCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniarecommend",
    description: "Recommends osu!mania farm maps.",
    aliases: ["mrec"],
    prefixOnly: true,
})
export class ManiaFarmRecommendCommand extends AbstractFarmRecommendCommand {
    protected forcedMode = GameMode.Mania;
}
