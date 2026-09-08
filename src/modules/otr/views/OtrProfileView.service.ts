import { TMessagePayload } from "@/core/discord/context/MessagePayload";
import { ActionRow } from "@/core/discord/ui/ActionRow";
import { Embed } from "@/core/discord/ui/Embed";
import { SelectMenu } from "@/core/discord/ui/SelectMenu";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { PopulatedUser } from "@domain/osu/Profile.dto";
import { otrFormPeriodLabel } from "@domain/otr/configs/OtrProfile.config";
import { OtrProfileFormatter } from "@domain/otr/formatters/OtrProfile.formatter";
import { OtrPlayerFrequencyDto, OtrPlayerStatsDto } from "@domain/otr/OtrPlayer.dto";
import { OtrPlayerAttributesCalculator } from "@domain/otr/utils/OtrPlayerAttributesCalculator";
import { EOtrFormPeriod, EOtrProfileView, OtrProfileViewDto } from "@domain/otr/views/OtrProfile.view";

export class OtrProfileViewService extends AbstractViewService<OtrProfileViewDto, EOtrProfileView> {
    protected readonly ttl = 120;

    public build(sessionID: string, data: OtrProfileViewDto, view: EOtrProfileView): TMessagePayload {
        return {
            embeds: [this.view(data, view)],
            components: this.components(sessionID, data, view),
        };
    }

    public createBaseEmbed(
        profile: PopulatedUser,
        stats: OtrPlayerStatsDto,
        timestamp: number | null = Date.now(),
    ): Embed {
        const rating = stats.rating;

        const author = rating
            ? `${profile.username}: ${OtrProfileFormatter.rating(rating.rating)} o!TR (${ProfileFormatter.rank(rating.globalRank)})`
            : `${profile.username}: Unrated`;

        return new Embed()
            .setThumbnail(ProfileFormatter.avatar(profile.provider, profile.id, timestamp))
            .setAuthor({
                name: author,
                iconURL: DiscordFormatter.countryFlag(this.config.app.flags, profile.countryCode),
                url: OtrProfileFormatter.link(stats.playerInfo.id, stats.ruleset),
            })
            .setFooter({
                text: `o!TR`,
                iconURL: ProfileFormatter.modeIcon(profile.mode),
            });
    }

    public overview(data: OtrProfileViewDto): Embed {
        const embed = this.createBaseEmbed(data.profile, data.stats, data.timestamp);
        const { rating, matchStats } = data.stats;

        if (!rating) {
            return embed.setDescription(`No o!TR rating is currently available for this player.`);
        }

        const record = matchStats ? OtrProfileFormatter.record(matchStats.matchesWon, matchStats.matchesLost) : "N/A";

        embed.addFields(
            {
                name: "Rating",
                value: OtrProfileFormatter.rating(rating.rating),
                inline: true,
            },
            {
                name: "Global Rank",
                value: ProfileFormatter.rank(rating.globalRank),
                inline: true,
            },
            {
                name: "Country Rank",
                value: ProfileFormatter.rank(rating.countryRank),
                inline: true,
            },
            {
                name: "Tier",
                value: OtrProfileFormatter.tier(rating.tierProgress.currentTier, rating.tierProgress.currentSubTier),
                inline: true,
            },
            {
                name: "Peak Rating",
                value: matchStats?.highestRating ? DiscordFormatter.fixed(matchStats.highestRating).toString() : "N/A",
                inline: true,
            },
            {
                name: "Status",
                value: rating.isProvisional ? "Provisional" : "Established",
                inline: true,
            },
            {
                name: "Tournaments",
                value: DiscordFormatter.number(rating.tournamentsPlayed),
                inline: true,
            },
            {
                name: "Matches",
                value: DiscordFormatter.number(rating.matchesPlayed),
                inline: true,
            },
            {
                name: "Match Record",
                value: record,
                inline: true,
            },
        );

        return embed;
    }

    public performance(data: OtrProfileViewDto): Embed {
        const embed = this.createBaseEmbed(data.profile, data.stats, data.timestamp);
        const stats = data.stats.matchStats;

        if (!stats) {
            return embed.setDescription("No tournament performance statistics are currently available.");
        }

        embed.addFields(
            {
                name: "Match Record",
                value: OtrProfileFormatter.record(stats.matchesWon, stats.matchesLost, true),
                inline: true,
            },
            {
                name: "Game Record",
                value: OtrProfileFormatter.record(stats.gamesWon, stats.gamesLost, true),
                inline: true,
            },
            {
                name: "Best Win Streak",
                value: DiscordFormatter.number(stats.bestWinStreak),
                inline: true,
            },
            {
                name: "Average Match Cost",
                value: DiscordFormatter.fixed(stats.averageMatchCostAggregate, 3).toString(),
                inline: true,
            },
            {
                name: "Average Score",
                value: DiscordFormatter.number(Math.round(stats.matchAverageScoreAggregate)),
                inline: true,
            },
            {
                name: "Average Misses",
                value: DiscordFormatter.fixed(stats.matchAverageMissesAggregate).toString(),
                inline: true,
            },
            {
                name: "Average Games",
                value: DiscordFormatter.fixed(stats.averageGamesPlayedAggregate).toString(),
                inline: true,
            },
            {
                name: "Average Placement",
                value: DiscordFormatter.fixed(stats.averagePlacingAggregate).toString(),
                inline: true,
            },
            {
                name: "Rating Gained",
                value: DiscordFormatter.delta(DiscordFormatter.fixed(stats.ratingGained)),
                inline: true,
            },
        );

        return embed;
    }

    public connections(data: OtrProfileViewDto): Embed {
        const embed = this.createBaseEmbed(data.profile, data.stats, data.timestamp);

        embed.addFields(
            {
                name: "Frequent Teammates",
                value: this.formatConnections(data.stats.frequentTeammates),
                inline: true,
            },
            {
                name: "Frequent Opponents",
                value: this.formatConnections(data.stats.frequentOpponents),
                inline: true,
            },
        );

        return embed;
    }

    public tournaments(data: OtrProfileViewDto): Embed {
        const embed = this.createBaseEmbed(data.profile, data.stats, data.timestamp);

        if (!data.tournaments?.length) {
            return embed.setDescription("No tournament history was found for this player.");
        }

        const tournaments = [...data.tournaments].sort((a, b) => {
            const aDate = a.startTime ?? a.created;
            const bDate = b.startTime ?? b.created;

            return bDate.getTime() - aDate.getTime();
        });

        return embed.setDescription(OtrProfileFormatter.tournaments(tournaments));
    }

    public form(data: OtrProfileViewDto): Embed {
        const embed = this.createBaseEmbed(data.profile, data.stats, data.timestamp);
        const stats = data.formStats?.matchStats;

        if (!stats) {
            return embed.setDescription(
                `No tournament activity was found in the last ${otrFormPeriodLabel[data.formPeriod].toLowerCase()}.`,
            );
        }

        embed.setDescription(`Tournament performance over **${otrFormPeriodLabel[data.formPeriod]}**.`).addFields(
            {
                name: "Rating Change",
                value: DiscordFormatter.delta(DiscordFormatter.fixed(stats.ratingGained)),
                inline: true,
            },
            {
                name: "Match Record",
                value: OtrProfileFormatter.record(stats.matchesWon, stats.matchesLost, true),
                inline: true,
            },
            {
                name: "Game Record",
                value: OtrProfileFormatter.record(stats.gamesWon, stats.gamesLost, true),
                inline: true,
            },
            {
                name: "Best Streak",
                value: DiscordFormatter.number(stats.bestWinStreak),
                inline: true,
            },
            {
                name: "Avg Match Cost",
                value: DiscordFormatter.fixed(stats.averageMatchCostAggregate, 3).toString(),
                inline: true,
            },
            {
                name: "Avg Games",
                value: DiscordFormatter.fixed(stats.averageGamesPlayedAggregate).toString(),
                inline: true,
            },
            {
                name: "Avg Score",
                value: DiscordFormatter.number(Math.round(stats.matchAverageScoreAggregate)),
                inline: true,
            },
            {
                name: "Avg Accuracy",
                value: `${DiscordFormatter.fixed(stats.matchAverageAccuracyAggregate)}%`,
                inline: true,
            },
            {
                name: "Avg Misses",
                value: DiscordFormatter.fixed(stats.matchAverageMissesAggregate).toString(),
                inline: true,
            },
            {
                name: "Avg Placement",
                value: DiscordFormatter.fixed(stats.averagePlacingAggregate).toString(),
                inline: true,
            },
        );

        return embed;
    }

    public mods(data: OtrProfileViewDto): Embed {
        const embed = this.createBaseEmbed(data.profile, data.stats, data.timestamp);
        const stats = OtrPlayerAttributesCalculator.normalizeModStats(data.stats.modStats);

        if (!stats.length) {
            return embed.setDescription("No tournament mod statistics are available for this player.");
        }

        const ordered = [...stats].sort((a, b) => b.count - a.count);
        const total = stats.reduce((sum, stat) => sum + stat.count, 0);

        const usage = ordered.map((stat) => ({
            label: `${stat.mods}:`,
            value: `${DiscordFormatter.fixed((stat.count / total) * 100)}%`,
        }));

        const averageScore = ordered.map((stat) => ({
            label: `${stat.mods}:`,
            value: DiscordFormatter.number(Math.round(stat.averageScore)),
        }));

        const bestScoring = [...stats].sort((a, b) => b.averageScore - a.averageScore).at(0);

        embed.addFields(
            {
                name: "Best Average",
                value: bestScoring ? bestScoring.mods : "N/A",
                inline: true,
            },
            {
                name: "Games",
                value: DiscordFormatter.number(total),
                inline: true,
            },
            {
                name: "Mod Usage",
                value: DiscordFormatter.formatInlineGrid(usage, 3, 64, " • "),
                inline: false,
            },
            {
                name: "Average Score",
                value: DiscordFormatter.formatInlineGrid(averageScore, 3, 64, " • "),
                inline: false,
            },
        );

        return embed;
    }

    //#region Internal

    private components(sessionID: string, data: OtrProfileViewDto, view: EOtrProfileView): Array<ActionRow> {
        const menu = new SelectMenu(`otr_profile:${sessionID}`)
            .setCurrent(view)
            .addChoice("Overview", EOtrProfileView.Overview, "Tournament rating overview")
            .addChoice("Performance", EOtrProfileView.Performance, "Detailed tournament performance")
            .addChoice("Form", EOtrProfileView.Form, "Recent tournament performance")
            .addChoice("Mods", EOtrProfileView.Mods, "Tournament mod statistics")
            .addChoice("Connections", EOtrProfileView.Connections, "Frequent teammates and opponents")
            .addChoice("Tournaments", EOtrProfileView.Tournaments, "Tournament history");

        const rows = [new ActionRow().add(menu)];

        if (view === EOtrProfileView.Form) {
            const period = new SelectMenu(`otr_profile_form:${sessionID}`)
                .setCurrent(data.formPeriod)
                .addChoice("30 days", EOtrFormPeriod.Days30)
                .addChoice("90 days", EOtrFormPeriod.Days90)
                .addChoice("6 months", EOtrFormPeriod.Months6)
                .addChoice("1 year", EOtrFormPeriod.Year1)
                .addChoice("All time", EOtrFormPeriod.All);

            rows.push(new ActionRow().add(period));
        }

        return rows;
    }

    private view(data: OtrProfileViewDto, view: EOtrProfileView): Embed {
        switch (view) {
            case EOtrProfileView.Overview:
                return this.overview(data);
            case EOtrProfileView.Performance:
                return this.performance(data);
            case EOtrProfileView.Form:
                return this.form(data);
            case EOtrProfileView.Mods:
                return this.mods(data);
            case EOtrProfileView.Connections:
                return this.connections(data);
            case EOtrProfileView.Tournaments:
                return this.tournaments(data);
            default:
                return this.overview(data);
        }
    }

    private formatConnections(connections: ReadonlyArray<OtrPlayerFrequencyDto>): string {
        const items = connections.slice(0, 10).map((entry) => ({
            label: entry.player.username,
            value: `${DiscordFormatter.number(entry.frequency)}x`,
        }));

        return DiscordFormatter.formatInlineGrid(items, 1, 64, " ");
    }

    //#endregion
}
