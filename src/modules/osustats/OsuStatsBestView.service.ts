import { Embed } from "@/core/discord/ui/Embed";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { Pagination } from "@domain/discord/utils/Pagination";
import { DescriptionBuilder } from "@/core/discord/ui/DescriptionBuilder";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";
import { ScoreFormatter } from "@domain/osu/formatters/Score.formatter";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { OsuStatsFormatter } from "@domain/osustats/formatters/OsuStats.formatter";
import { OsuStatsBestViewDto } from "@domain/osustats/views/OsuStatsBest.view";
import { osuStatsBestPageSize } from "@domain/osustats/configs/OsuStatsBest.config";
import { scoreStatsDelimiter } from "@domain/osu/configs/Score.config";
import { discordMaxVisualLineLength } from "@domain/discord/configs/Discord.config";
import { osuStatsBaseUrl } from "@domain/osustats/configs/OsuStats.config";
import { AdapterProvider } from "@generated/adapter/types";

export class OsuStatsBestViewService extends AbstractViewService<OsuStatsBestViewDto> {
    protected readonly ttl = 180;

    public build(sessionID: string, data: OsuStatsBestViewDto): TMessagePayload {
        const totalPages = Math.ceil(data.scores.length / osuStatsBestPageSize) || 1;
        const start = (data.page - 1) * osuStatsBestPageSize;
        const scores = data.scores.slice(start, start + osuStatsBestPageSize);

        const description = new DescriptionBuilder();

        for (const [offset, score] of scores.entries()) {
            const index = (data.page - 1) * osuStatsBestPageSize + offset + 1;
            const mods = ScoreFormatter.mods(score.parsedMods());

            const prefixLength = `${index}. `.length;
            const suffixLength = (mods ? ` ${mods}`.length : 0) + ` by ${score.user.username}`.length;
            const headerLimit = Math.max(20, discordMaxVisualLineLength - prefixLength - suffixLength);

            const header = MapFormatter.header(score.map.artist, score.map.title, score.map.version, headerLimit);
            const linkedHeader = DiscordFormatter.link(header, MapFormatter.link(score.map.beatmapID));

            const username = DiscordFormatter.link(
                score.user.username,
                ProfileFormatter.link(AdapterProvider.Bancho, score.user.userID),
            );

            description
                .add(`**${index}\\. ${linkedHeader}${mods ? ` ${mods}` : ""}** by ${username}`)
                .add(
                    [
                        [ScoreFormatter.grade(score.grade, true), ScoreFormatter.accuracy(score.accuracy / 100)].join(
                            " ",
                        ),
                        ScoreFormatter.pp(score.pp),
                        ScoreFormatter.combo(score.maxCombo, score.map.maxCombo),
                        DateFormatter.discord(score.endedAt, "R"),
                    ].join(`${scoreStatsDelimiter}`),
                );
        }

        const embed = new Embed()
            .setAuthor({
                name: "osu!stats • best scores",
                url: osuStatsBaseUrl,
            })
            .setDescription(description.buildOr("No scores."))
            .setFooter({
                iconURL: ProfileFormatter.modeIcon(data.mode),
                text: `${DateFormatter.shortDate(data.startDate)} - ${DateFormatter.shortDate(data.endDate)}`,
            });

        const first = scores[0];
        if (first) {
            embed.setThumbnail(ProfileFormatter.avatar(AdapterProvider.Bancho, first.user.userID));
        }

        const components = totalPages > 1 ? [Pagination.build("osustats_best", sessionID, data.page, totalPages)] : [];
        return {
            content: OsuStatsFormatter.bestFilters(data.mode, data.timeframe, data.sort, data.order),
            embeds: [embed],
            components,
        };
    }
}
