import { IsString, Option, Required, Subcommand } from "@/core/decorators";
import { CommandOption } from "@domain/core/Command";
import { AbstractSnipeRankingCommand } from "./AbstractSnipeRankingCommand";

@Subcommand({
    root: "snipe",
    group: "country",
    name: "list",
    description: "Shows a country's national #1 leaderboard.",
})
export class SnipeCountryListSubcommand extends AbstractSnipeRankingCommand {
    @Option("country", "Two-letter country code.")
    @IsString(2, 2)
    @Required()
    declare private readonly country: CommandOption<string>;

    protected resolveCountry(): string {
        return this.country.unwrap().toUpperCase();
    }
}
