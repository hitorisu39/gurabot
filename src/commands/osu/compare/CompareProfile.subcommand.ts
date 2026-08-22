import { Category, Command, Subcommand } from "@/core/decorators";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";
import { AbstractCompareProfileCommand } from "./AbstractCompareProfileCommand";

@Subcommand({
    root: "compare",
    name: "profile",
    description: "Compares two osu! player profiles.",
})
export class CompareProfileSubcommand extends AbstractCompareProfileCommand {}

@Command({
    name: "compareprofile",
    description: "Compares two osu! player profiles.",
    aliases: ["profilecompare", "pc", "oc", "osucompare", "compareosu"],
    prefixOnly: true,
})
export class CompareProfileCommand extends AbstractCompareProfileCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikocompareprofile",
    description: "Compares two osu!taiko player profiles.",
    aliases: ["compareprofiletaiko", "profilecomparetaiko", "taikoprofilecompare", "taikopc", "tpc"],
    prefixOnly: true,
})
export class TaikoCompareProfileCommand extends AbstractCompareProfileCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchcompareprofile",
    description: "Compares two osu!catch player profiles.",
    aliases: [
        "compareprofilecatch",
        "profilecomparecatch",
        "catchprofilecompare",
        "ctbcompareprofile",
        "catchpc",
        "ctbpc",
        "cpc",
    ],
    prefixOnly: true,
})
export class CatchCompareProfileCommand extends AbstractCompareProfileCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniacompareprofile",
    description: "Compares two osu!mania player profiles.",
    aliases: ["compareprofilemania", "profilecomparemania", "maniaprofilecompare", "maniapc", "mpc"],
    prefixOnly: true,
})
export class ManiaCompareProfileCommand extends AbstractCompareProfileCommand {
    protected forcedMode = GameMode.Mania;
}
