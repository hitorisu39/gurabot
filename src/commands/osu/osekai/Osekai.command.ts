import { Command, IsEnum, Option, Subcommand } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { EOsekaiMapsetRankingType, EOsekaiRanking } from "@domain/osekai/enums/OsekaiRanking.enum";
import { AbstractOsekaiRankingCommand } from "./AbstractOsekaiRankingCommand";
import { AbstractOsekaiAllModeRankingCommand } from "./AbstractOsekaiAllModeRankingCommand";
import { CommandOption } from "@domain/core/Command";

@Command({
    name: "osekai",
    description: "Various rankings and statistics provided by Osekai.",
    defer: false,
    slashOnly: true,
})
export class OsekaiRootCommand extends AbstractCommand {
    public async execute(): Promise<void> {
        return;
    }
}

@Subcommand({
    root: "osekai",
    name: "medals",
    description: "Shows players with the most medals.",
})
export class OsekaiMedalsSubcommand extends AbstractOsekaiRankingCommand {
    protected getRanking(): EOsekaiRanking {
        return EOsekaiRanking.MedalCount;
    }
}

@Subcommand({
    root: "osekai",
    name: "rarity",
    description: "Shows the rarest osu! medals.",
})
export class OsekaiRaritySubcommand extends AbstractOsekaiRankingCommand {
    protected getRanking(): EOsekaiRanking {
        return EOsekaiRanking.MedalRarity;
    }
}

@Subcommand({
    root: "osekai",
    name: "pp",
    description: "Shows all-mode PP rankings.",
})
export class OsekaiPPSubcommand extends AbstractOsekaiAllModeRankingCommand {
    protected readonly standardDeviationRanking = EOsekaiRanking.PPStandardDeviation;
    protected readonly totalRanking = EOsekaiRanking.PPTotal;
}

@Subcommand({
    root: "osekai",
    name: "level",
    description: "Shows all-mode level rankings.",
})
export class OsekaiLevelSubcommand extends AbstractOsekaiAllModeRankingCommand {
    protected readonly standardDeviationRanking = EOsekaiRanking.LevelStandardDeviation;
    protected readonly totalRanking = EOsekaiRanking.LevelTotal;
}

@Subcommand({
    root: "osekai",
    name: "accuracy",
    description: "Shows all-mode accuracy rankings.",
})
export class OsekaiAccuracySubcommand extends AbstractOsekaiAllModeRankingCommand {
    protected readonly standardDeviationRanking = EOsekaiRanking.AccuracyStandardDeviation;
    protected readonly totalRanking = EOsekaiRanking.AccuracyTotal;
}

@Subcommand({
    root: "osekai",
    name: "replays",
    description: "Shows players with the most replays watched.",
})
export class OsekaiReplaysSubcommand extends AbstractOsekaiRankingCommand {
    protected getRanking(): EOsekaiRanking {
        return EOsekaiRanking.Replays;
    }
}

@Subcommand({
    root: "osekai",
    name: "mapsets",
    description: "Shows mappers with the most ranked or loved mapsets.",
})
export class OsekaiMapsetsSubcommand extends AbstractOsekaiRankingCommand {
    @Option("type", "Specify ranked or loved mapsets")
    @IsEnum(EOsekaiMapsetRankingType)
    declare private readonly type: CommandOption<EOsekaiMapsetRankingType>;

    protected getRanking(): EOsekaiRanking {
        const type = this.type.unwrapOr(EOsekaiMapsetRankingType.Ranked);
        return type === EOsekaiMapsetRankingType.Loved ? EOsekaiRanking.LovedMapsets : EOsekaiRanking.RankedMapsets;
    }
}

@Subcommand({
    root: "osekai",
    name: "subscribers",
    description: "Shows mappers with the most subscribers.",
})
export class OsekaiSubscribersSubcommand extends AbstractOsekaiRankingCommand {
    protected getRanking(): EOsekaiRanking {
        return EOsekaiRanking.Subscribers;
    }
}

@Subcommand({
    root: "osekai",
    name: "badges",
    description: "Shows players with the most profile badges.",
})
export class OsekaiBadgesSubcommand extends AbstractOsekaiRankingCommand {
    protected getRanking(): EOsekaiRanking {
        return EOsekaiRanking.Badges;
    }
}

@Subcommand({
    root: "osekai",
    name: "playtime",
    description: "Shows all-mode playtime rankings.",
})
export class OsekaiPlaytimeSubcommand extends AbstractOsekaiAllModeRankingCommand {
    protected readonly standardDeviationRanking = EOsekaiRanking.PlaytimeStandardDeviation;
    protected readonly totalRanking = EOsekaiRanking.PlaytimeTotal;
}
