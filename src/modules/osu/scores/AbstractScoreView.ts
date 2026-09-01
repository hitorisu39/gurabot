import { Import } from "@/core/decorators";
import { Embed } from "@/core/discord/ui/Embed";
import { AbstractService } from "@/core/framework/AbstractService";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { ScoresViewDto } from "@domain/osu/views/Scores.view";
import { GameMode, Score } from "@generated/adapter/types";
import { ProfileViewService } from "../profile/ProfileView.service";
import { DescriptionBuilder } from "@/core/discord/ui/DescriptionBuilder";
import { ScoreFormatter } from "@domain/osu/formatters/Score.formatter";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { scoreStatsDelimiter } from "@domain/osu/configs/Score.config";
import { EScoreListSize } from "@domain/osu/enums/Score.enum";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { ScoreUtils } from "@domain/osu/utils/ScoreUtils";
import { BeatmapUtils } from "@domain/osu/utils/BeatmapUtils";
import { discordEmoteTwitch } from "@domain/discord/configs/Emotes.config";

export abstract class AbstractScoreView extends AbstractService {
    @Import() declare protected readonly profileViewService: ProfileViewService;

    /**
     * Determines the pagination size for this specific layout.
     */
    public abstract getPageSize(size: EScoreListSize, activeAttributes?: Array<string>): number;

    /**
     * Renders the specific layout.
     */
    public abstract render(data: ScoresViewDto, pageScores: Array<Score>, meta?: Record<string, unknown>): Embed;

    /**
     * Universal fallback for when exactly 1 score is returned, bypassing the list layout.
     */
    public renderSingle(data: ScoresViewDto, score: Score): Embed {
        const embed = this.profileViewService.createBaseEmbed(data.profile, data.timestamp, false);
        if (!ScoreUtils.isFullyPopulated(score)) return embed;

        const placement = ScoreFormatter.placement(score);
        const twitch = data.twitch
            ? `${discordEmoteTwitch} [${data.twitch.type === "liveplay" ? "Liveplay on Twitch" : "Live on Twitch"}](${data.twitch.url})`
            : null;

        const embedDescription = [twitch, placement].filter(Boolean).join("\n");
        if (embedDescription) embed.setDescription(embedDescription);

        const description = new DescriptionBuilder();
        const isMania = data.profile.mode === GameMode.Mania;

        const stars = MapFormatter.stars(score.fullDifficulty.starRating);
        const mods = ScoreFormatter.mods(score.mods);

        const scoreNum = DiscordFormatter.number(score.legacyTotalScore || score.totalScore);
        const scoreDisplay = isMania ? `**${scoreNum}**` : scoreNum;

        const completion = !score.passed
            ? ScoreFormatter.completion(score.statistics, score.beatmap, data.profile.mode)
            : null;
        const grade = ScoreFormatter.grade(score.grade, score.passed, null, completion);

        const accOrMods = mods
            ? `${mods} ${DiscordFormatter.space(2)} ${ScoreFormatter.accuracy(score.accuracy)}`
            : ScoreFormatter.accuracy(score.accuracy);

        const statsFirstRow = [`${grade} ${accOrMods}`, scoreDisplay, DateFormatter.discord(score.endedAt, "R")]
            .filter(Boolean)
            .join(DiscordFormatter.space(4));

        const pp = ScoreFormatter.pp(
            score.pp ?? score.calculated.attributes.total,
            score.calculatedFC?.attributes.total,
        );

        let comboRatioString;
        if (isMania) {
            const perfect = score.statistics.perfect ?? 0;
            const great = score.statistics.great ?? 0;
            const ratio = great > 0 ? (perfect / great).toFixed(2) : perfect.toString();
            comboRatioString = `${score.maxCombo}x / **${ratio}**`;
        } else {
            comboRatioString = ScoreFormatter.combo(score.maxCombo, score.fullDifficulty.maxCombo, true);
        }

        const hitsString = `${ScoreFormatter.statistics(score.statistics, data.profile.mode, "/")}`;
        const statsSecondRow = [pp, comboRatioString, hitsString].filter(Boolean).join(scoreStatsDelimiter);

        const attrs = score.calculated.difficulty.beatmap;
        const length = BeatmapUtils.length(score.beatmap.totalLength, attrs.clockRate);
        const bpm = BeatmapUtils.bpm(score.beatmap.bpm, attrs.clockRate);

        const statsThirdRow = [
            MapFormatter.length(length),
            MapFormatter.attributes(data.profile.mode, attrs),
            MapFormatter.bpm(bpm),
        ]
            .filter(Boolean)
            .join(scoreStatsDelimiter);

        description.add(statsSecondRow).add(statsThirdRow);

        /**
         * A workaround to put score id somewhere in the embed
         * since markdown is not allowed in field names.
         */
        const thumbnail = new URL(score.beatmapset.covers.listDouble);
        if (score.id) thumbnail.searchParams.set("score_id", score.id.toString());

        return embed
            .setFooter({
                text: `${score.beatmap.status} by ${score.beatmapset.creator}`,
                iconURL: ProfileFormatter.modeIcon(data.profile.mode),
            })
            .addFields({ name: statsFirstRow, value: description.build() })
            .setThumbnail(thumbnail.toString())
            .setTitle(`${score.beatmapset.artist} - ${score.beatmapset.title} [${score.beatmap.version}] [${stars}]`)
            .setURL(MapFormatter.link(score.beatmap.id));
    }
}
