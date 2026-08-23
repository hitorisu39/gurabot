import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { Embed } from "@/core/discord/ui/Embed";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { Pagination } from "@domain/discord/utils/Pagination";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { ScoreFormatter } from "@domain/osu/formatters/Score.formatter";
import { CommonTopComparisonDto, CompareTopViewDto } from "@domain/osu/views/CompareTop.view";

interface ICommonScoreSummary {
    leftWins: number;
    rightWins: number;
    ties: number;
}

export class CompareTopViewService extends AbstractViewService<CompareTopViewDto> {
    protected readonly ttl = 180;
    private readonly pageSize = 10;

    public build(sessionID: string, data: CompareTopViewDto): TMessagePayload {
        const count = data.comparisons.length;
        if (!count)
            return Embed.error(
                `\`${data.left.username}\` and \`${data.right.username}\` have no common maps in their top.`,
            );

        const content = this.content(data);

        if (!count) {
            return {
                content,
                embeds: [],
                components: [],
            };
        }

        const totalPages = Math.ceil(count / this.pageSize) || 1;
        const page = Math.min(Math.max(data.page, 1), totalPages);
        const start = (page - 1) * this.pageSize;

        const comparisons = data.comparisons.slice(start, start + this.pageSize);
        const components = totalPages > 1 ? [Pagination.build("osu_common_scores", sessionID, page, totalPages)] : [];

        return {
            content,
            embeds: [this.embed(data, comparisons, start)],
            components,
        };
    }

    public getPageSize(): number {
        return this.pageSize;
    }

    private content(data: CompareTopViewDto): string {
        const left = `\`${data.left.username}\``;
        const right = `\`${data.right.username}\``;

        const count = data.comparisons.length;
        return (
            `${left} and ${right} have ` +
            `**${DiscordFormatter.number(count)}** common ` +
            `${DiscordFormatter.plural(count, "map")} in their top:`
        );
    }

    private embed(
        data: CompareTopViewDto,
        comparisons: ReadonlyArray<CommonTopComparisonDto>,
        startIndex: number,
    ): Embed {
        const description = comparisons
            .map((comparison, index) => this.comparison(comparison, data, startIndex + index + 1))
            .join("\n");

        const summary = this.summary(data.comparisons);

        return new Embed().setDescription(description).setFooter({
            iconURL: ProfileFormatter.modeIcon(data.left.mode),
            text: [
                `🥇 ${data.left.username}: ${summary.leftWins}`,
                `🥇 ${data.right.username}: ${summary.rightWins}`,
                `🤝 ${summary.ties}`,
            ]
                .filter(Boolean)
                .join(" • "),
        });
    }

    private comparison(comparison: CommonTopComparisonDto, data: CompareTopViewDto, index: number): string {
        const set = comparison.beatmap.beatmapset!;

        const header = MapFormatter.header(set.artist, set.title, comparison.beatmap.version);
        const linkedHeader = DiscordFormatter.link(header, MapFormatter.link(comparison.beatmapID));

        const leftMedal = this.medal(comparison.leftPP, comparison.rightPP);
        const rightMedal = this.medal(comparison.rightPP, comparison.leftPP);

        return [
            `**${index}\\.** ${linkedHeader}`,
            `${leftMedal} \`${data.left.username}\`: ` +
                `${ScoreFormatter.pp(comparison.leftPP)}` +
                `${DiscordFormatter.space(4)}` +
                `${rightMedal} \`${data.right.username}\`: ` +
                `${ScoreFormatter.pp(comparison.rightPP)}`,
        ].join("\n");
    }

    private medal(value: number, opponent: number): string {
        if (value > opponent) {
            return "🥇";
        }

        if (value < opponent) {
            return "🥈";
        }

        return "🤝";
    }

    private summary(comparisons: ReadonlyArray<CommonTopComparisonDto>): ICommonScoreSummary {
        let leftWins = 0;
        let rightWins = 0;
        let ties = 0;

        for (const comparison of comparisons) {
            if (comparison.leftPP > comparison.rightPP) {
                leftWins++;
            } else if (comparison.rightPP > comparison.leftPP) {
                rightWins++;
            } else {
                ties++;
            }
        }

        return {
            leftWins,
            rightWins,
            ties,
        };
    }
}
