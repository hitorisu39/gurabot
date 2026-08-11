import { Category, Command } from "@/core/decorators";
import { GameMode } from "@generated/adapter/types";
import { AbstractTopCommand } from "./AbstractTopCommand";
import { ECommandCategory } from "@domain/core/Command";

@Command({
    name: "top",
    description: "Shows top 100 plays of an osu! player.",
    aliases: ["osutop", "t"],
})
export class TopCommand extends AbstractTopCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikotop",
    description: "Shows top 100 taiko plays of an osu! player.",
    aliases: ["toptaiko", "topt", "ttop", "tt"],
    prefixOnly: true,
})
export class TaikoTopCommand extends AbstractTopCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchtop",
    description: "Shows top 100 catch plays of an osu! player.",
    aliases: ["topctb", "catchtop", "topcatch", "ctop", "topc", "tc"],
    prefixOnly: true,
})
export class CatchTopCommand extends AbstractTopCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniatop",
    description: "Shows top 100 mania plays of an osu! player.",
    aliases: ["topmania", "mtop", "topm", "tm"],
    prefixOnly: true,
})
export class ManiaTopCommand extends AbstractTopCommand {
    protected forcedMode = GameMode.Mania;
}
