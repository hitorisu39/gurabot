import { Import, IsString, Option, Required, Subcommand } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { SnipeService } from "@/modules/snipe/Snipe.service";
import { SnipeCountryStatsViewService } from "@/modules/snipe/SnipeCountryStatsView.service";
import { CommandOption } from "@domain/core/Command";
import { ESnipeRankingSort } from "@domain/snipe/enums/Snipe.enum";

@Subcommand({
    root: "snipe",
    group: "country",
    name: "stats",
    description: "Shows national #1 statistics for a country.",
})
export class SnipeCountryStatsSubcommand extends AbstractCommand {
    @Import() declare private readonly snipeService: SnipeService;
    @Import() declare private readonly snipeCountryStatsViewService: SnipeCountryStatsViewService;

    @Option("country", "Two-letter country code.")
    @IsString(2, 2)
    @Required()
    declare private readonly country: CommandOption<string>;

    public async execute(ctx: CommandContext): Promise<void> {
        const country = this.country.unwrap().toUpperCase();

        const [statistics, ranking] = await Promise.all([
            this.snipeService.countryStatistics(country),
            this.snipeService.ranking(country, ESnipeRankingSort.WeightedPP),
        ]);

        await ctx.respond(
            await this.snipeCountryStatsViewService.build({
                country,
                statistics,
                players: ranking.players,
            }),
        );
    }
}
