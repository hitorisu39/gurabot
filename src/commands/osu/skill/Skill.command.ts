import { Category, Command, Subcommand } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { GameMode } from "@generated/adapter/types";
import { AbstractSkillStatsCommand } from "./AbstractSkillStatsCommand";
import { AbstractSkillCardCommand } from "./AbstractSkillCardCommand";
import { ECommandCategory } from "@domain/core/Command";

@Command({
    name: "skill",
    description: "The root command for skill subcommands.",
    defer: false,
    slashOnly: true,
})
export class SkillRootCommand extends AbstractCommand {
    public async execute(): Promise<void> {
        return;
    }
}

// Slash subcommands

@Subcommand({
    root: "skill",
    name: "stats",
    description: "Calculates skill statistics from an osu! player's top plays.",
})
export class SkillStatsSubcommand extends AbstractSkillStatsCommand {}

@Subcommand({
    root: "skill",
    name: "card",
    description: "Generates a skill card from an osu! player's top plays.",
})
export class SkillCardSubcommand extends AbstractSkillCardCommand {}

// Stats prefix commands

@Command({
    name: "skills",
    description: "Calculates skill statistics from an osu! player's top plays.",
    aliases: ["skill"],
    prefixOnly: true,
})
export class SkillsCommand extends AbstractSkillStatsCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikoskills",
    description: "Calculates skill statistics from an osu!taiko player's top plays.",
    aliases: ["skillstaiko", "tskills", "skillst"],
    prefixOnly: true,
})
export class TaikoSkillsCommand extends AbstractSkillStatsCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchskills",
    description: "Calculates skill statistics from an osu!catch player's top plays.",
    aliases: ["skillsctb", "ctbskills", "skillscatch", "cskills", "skillsc"],
    prefixOnly: true,
})
export class CatchSkillsCommand extends AbstractSkillStatsCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniaskills",
    description: "Calculates skill statistics from an osu!mania player's top plays.",
    aliases: ["skillsmania", "mskills", "skillsm"],
    prefixOnly: true,
})
export class ManiaSkillsCommand extends AbstractSkillStatsCommand {
    protected forcedMode = GameMode.Mania;
}

// Card prefix commands

@Command({
    name: "skillcard",
    description: "Generates a skill card from an osu! player's top plays.",
    aliases: ["card"],
    prefixOnly: true,
})
export class SkillCardCommand extends AbstractSkillCardCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikocard",
    description: "Generates a skill card from an osu!taiko player's top plays.",
    aliases: ["cardtaiko", "tcard", "cardt"],
    prefixOnly: true,
})
export class TaikoCardCommand extends AbstractSkillCardCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchcard",
    description: "Generates a skill card from an osu!catch player's top plays.",
    aliases: ["cardctb", "ctbcard", "cardcatch", "ccard", "cardc"],
    prefixOnly: true,
})
export class CatchCardCommand extends AbstractSkillCardCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniacard",
    description: "Generates a skill card from an osu!mania player's top plays.",
    aliases: ["cardmania", "mcard", "cardm"],
    prefixOnly: true,
})
export class ManiaCardCommand extends AbstractSkillCardCommand {
    protected forcedMode = GameMode.Mania;
}
