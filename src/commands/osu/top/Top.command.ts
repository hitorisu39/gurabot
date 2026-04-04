import { Command } from "@/core/decorators";
import { GameMode } from "@generated/adapter/types";
import { AbstractTopCommand } from "./AbstractTopCommand";

@Command({
    name: "top",
    description: "Shows top 100 plays of an osu! player.",
    aliases: ["osutop"],
})
export class TopCommand extends AbstractTopCommand {}

@Command({
    name: "taikotop",
    description: "Shows top 100 taiko plays of an osu! player.",
    aliases: ["toptaiko", "topt", "ttop"],
    prefixOnly: true,
})
export class TaikoTopCommand extends AbstractTopCommand {
    protected forcedMode = GameMode.Taiko;
}

@Command({
    name: "ctbtop",
    description: "Shows top 100 catch plays of an osu! player.",
    aliases: ["topctb", "catchtop", "topcatch", "ctop", "topc"],
    prefixOnly: true,
})
export class CtbTopCommand extends AbstractTopCommand {
    protected forcedMode = GameMode.Catch;
}

@Command({
    name: "maniatop",
    description: "Shows top 100 mania plays of an osu! player.",
    aliases: ["topmania", "mtop", "topm"],
    prefixOnly: true,
})
export class ManiaTopCommand extends AbstractTopCommand {
    protected forcedMode = GameMode.Mania;
}
