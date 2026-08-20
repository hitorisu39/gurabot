import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { AbstractService } from "@/core/framework/AbstractService";
import { Embed } from "@/core/discord/ui/Embed";
import { AsciiTable } from "@domain/discord/utils/AsciiTable";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { OsuStatsCountsDto } from "@domain/osustats/OsuStatsCounts.dto";
import { OsuStatsCompareViewDto } from "@domain/osustats/views/OsuStatsCompare.view";
import { osuStatsBaseUrl } from "@domain/osustats/configs/OsuStats.config";
import { AdapterProvider } from "@generated/adapter/types";

interface IOsuStatsCompareRow {
    rank: string;
    left: number;
    right: number;
    delta: number;
}

export class OsuStatsCompareViewService extends AbstractService {
    public build(data: OsuStatsCompareViewDto): TMessagePayload {
        const rows = data.leftCounts.entries.map((entry): IOsuStatsCompareRow => {
            const right = this.countAt(data.rightCounts, entry.rank);

            return {
                rank: `Top ${entry.rank}`,
                left: entry.count,
                right,
                delta: entry.count - right,
            };
        });

        const table = new AsciiTable<IOsuStatsCompareRow>({
            columns: [
                {
                    header: "Rank",
                    accessor: "rank",
                },
                {
                    header: data.leftProfile.username,
                    accessor: (row) => DiscordFormatter.number(row.left),
                    align: "right",
                    headerAlign: "right",
                },
                {
                    header: data.rightProfile.username,
                    accessor: (row) => DiscordFormatter.number(row.right),
                    align: "right",
                    headerAlign: "right",
                },
                {
                    header: "Delta",
                    accessor: (row) => DiscordFormatter.delta(row.delta),
                    align: "right",
                    headerAlign: "right",
                },
            ],

            padding: 1,
            borders: {
                left: false,
                right: false,
                top: false,
                bottom: false,
            },
        });

        const left = DiscordFormatter.link(
            data.leftProfile.username,
            ProfileFormatter.link(AdapterProvider.Bancho, data.leftProfile.id),
            null,
            true,
        );

        const right = DiscordFormatter.link(
            data.rightProfile.username,
            ProfileFormatter.link(AdapterProvider.Bancho, data.rightProfile.id),
            null,
            true,
        );

        const embed = new Embed()
            .setAuthor({
                name: "osu!stats • compare",
                url: osuStatsBaseUrl,
            })
            .setDescription("```" + table.generate(rows) + "```")
            .setFooter({
                text: "Data provided by osu!stats",
                iconURL: ProfileFormatter.modeIcon(data.leftProfile.mode),
            });

        return {
            content: `${left} vs ${right} on global leaderboards:`,
            embeds: [embed],
        };
    }

    private countAt(counts: OsuStatsCountsDto, rank: number): number {
        return counts.entries.find((entry) => entry.rank === rank)?.count ?? 0;
    }
}
