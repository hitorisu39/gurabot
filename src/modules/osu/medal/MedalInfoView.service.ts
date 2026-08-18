import { AbstractService } from "@/core/framework/AbstractService";
import { Embed } from "@/core/discord/ui/Embed";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { OsekaiMedalBeatmapDto, OsekaiMedalCommentDto } from "@domain/osekai/OsekaiMedal.dto";
import { TextFormatter } from "@domain/discord/formatters/Text.formatter";
import { MedalInfoViewDto } from "@domain/osu/views/MedalInfo.view";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { discordMaxVisualLineLength } from "@domain/discord/configs/Discord.config";
import { MedalFormatter } from "@domain/osu/formatters/Medal.formatter";

export class MedalInfoViewService extends AbstractService {
    public build(data: MedalInfoViewDto): TMessagePayload {
        const embed = new Embed()
            .setTitle(data.medal.name)
            .setURL(data.medal.url())
            .setDescription(
                [MedalFormatter.requirements(data.medal), MedalFormatter.text(data.medal.description)]
                    .filter(Boolean)
                    .join("\n"),
            );

        // const instructions = this.medalText(data.medal.instructions);
        // if (instructions) {
        //     embed.addFields({
        //         name: "How to unlock",
        //         value: this.fieldValue(instructions, data.medal.url()),
        //     });
        // }

        embed.addFields(
            {
                name: "Solution",
                value: MedalFormatter.solutionField(data.medal, data.spoil),
            },
            {
                name: "Rarity",
                value: MedalFormatter.rarity(data.medal),
                inline: true,
            },
            {
                name: "Availability",
                value: MedalFormatter.availability(data.medal),
                inline: true,
            },
            {
                name: "First achieved",
                value: MedalFormatter.firstAchieved(data.medal),
                inline: true,
            },
        );

        const beatmaps = this.beatmaps(data.beatmaps);
        if (beatmaps) {
            embed.addFields({
                name: "Beatmaps",
                value: beatmaps,
            });
        }

        const comments = this.comments(data.comments, data.beatmaps);
        if (comments) {
            embed.addFields({
                name: "Top comments",
                value: comments,
            });
        }

        const mode = MedalFormatter.gamemode(data.medal.gamemode);
        embed.setFooter({
            text: MedalFormatter.footer(data.medal),
            iconURL: mode ? ProfileFormatter.modeIcon(mode) : undefined,
        });

        return {
            embeds: [embed],
        };
    }

    private beatmaps(beatmaps: ReadonlyArray<OsekaiMedalBeatmapDto>): string | null {
        if (!beatmaps.length) {
            return null;
        }

        const limit = 3;

        const lines = [...beatmaps]
            .sort((a, b) => b.votes - a.votes)
            .slice(0, limit)
            .map((beatmap) => {
                const votes = `[+${beatmap.votes}]`;

                const maxVisualLength = discordMaxVisualLineLength;
                const suffixLength = ` ${votes}`.length;
                const headerLimit = Math.max(20, maxVisualLength - suffixLength);

                const header = MapFormatter.header(beatmap.artist, beatmap.title, beatmap.difficulty, headerLimit);
                const mapLink = DiscordFormatter.link(header, MapFormatter.link(beatmap.beatmapID), null, true);

                return `${mapLink} \`${votes}\``;
            });

        if (beatmaps.length > limit) {
            lines.push(`\`...and ${beatmaps.length - limit} more\``);
        }

        return lines.join("\n");
    }

    private comments(
        comments: ReadonlyArray<OsekaiMedalCommentDto>,
        beatmaps: ReadonlyArray<OsekaiMedalBeatmapDto>,
    ): string | null {
        if (!comments.length) {
            return null;
        }

        return comments
            .map((comment) => {
                const username = comment.username ?? "Unknown";

                const text = TextFormatter.htmlToMarkdown(comment.text) ?? comment.text;
                const compact = text.replace(/\s+/g, " ").trim();

                const truncated = TextFormatter.truncate(compact, 300);
                const content = this.linkBeatmapMentions(truncated, beatmaps);

                return `${username} [+${comment.votes}]\n> ${content}`;
            })
            .join("\n");
    }

    private linkBeatmapMentions(text: string, beatmaps: ReadonlyArray<OsekaiMedalBeatmapDto>): string {
        if (!text || !beatmaps.length) {
            return text;
        }

        /*
         * null means the alias is ambiguous and shouldn't be linked.
         *
         * For example, if two maps are both:
         * "It Never Ends [Hard]"
         *
         * we don't want to arbitrarily choose one.
         */
        const candidates = new Map<string, { text: string; beatmapID: number } | null>();

        const addCandidate = (candidate: string, beatmapID: number): void => {
            const key = candidate.toLowerCase();

            if (!candidates.has(key)) {
                candidates.set(key, {
                    text: candidate,
                    beatmapID,
                });

                return;
            }

            const existing = candidates.get(key);

            if (existing?.beatmapID !== beatmapID) {
                candidates.set(key, null);
            }
        };

        for (const beatmap of beatmaps) {
            /*
             * Full form:
             * The Flashbulb - Passage D [Lyric's Advanced]
             */
            addCandidate(`${beatmap.artist} - ${beatmap.title} [${beatmap.difficulty}]`, beatmap.beatmapID);

            /*
             * Short form:
             * Passage D [Lyric's Advanced]
             */
            addCandidate(`${beatmap.title} [${beatmap.difficulty}]`, beatmap.beatmapID);
        }

        const matches = Array.from(candidates.values())
            .filter(
                (
                    candidate,
                ): candidate is {
                    text: string;
                    beatmapID: number;
                } => candidate !== null,
            )
            /*
             * Match the full artist/title form before the shorter title form.
             */
            .sort((a, b) => b.text.length - a.text.length);

        if (!matches.length) {
            return text;
        }

        const byText = new Map(matches.map((candidate) => [candidate.text.toLowerCase(), candidate]));
        const pattern = matches.map((candidate) => TextFormatter.escapeRegExp(candidate.text)).join("|");

        const regex = new RegExp(pattern, "gi");

        return text.replace(regex, (match) => {
            const candidate = byText.get(match.toLowerCase());

            if (!candidate) {
                return match;
            }

            return DiscordFormatter.link(match, MapFormatter.link(candidate.beatmapID), undefined, true);
        });
    }
}
