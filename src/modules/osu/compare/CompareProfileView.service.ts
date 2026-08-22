import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { ActionRow } from "@/core/discord/ui/ActionRow";
import { Embed } from "@/core/discord/ui/Embed";
import { SelectMenu } from "@/core/discord/ui/SelectMenu";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { AsciiTable } from "@domain/discord/utils/AsciiTable";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { TextFormatter } from "@domain/discord/formatters/Text.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { ScoresAttributesCalculator } from "@domain/osu/utils/ScoresAttributesCalculator";
import { UserAttributesCalculator } from "@domain/osu/utils/UserAttributesCalculator";
import {
    ECompareProfileView,
    CompareProfilePlayerDto,
    CompareProfileViewDto,
} from "@domain/osu/views/CompareProfile.view";
import { PopulatedScoreAverageDto } from "@domain/osu/Score.dto";
import { GameMode } from "@generated/adapter/types";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { isValidNumber } from "@domain/utils";
import { PopulatedUser } from "@domain/osu/Profile.dto";

type TComparisonDirection = "higher" | "lower";

interface ICompareRow {
    left: string;
    metric: string;
    right: string;

    leftValue?: number | null;
    rightValue?: number | null;

    direction?: TComparisonDirection;
}

interface IMapperSummary {
    uniqueMappers: number;
    mapperVariety: number;
    ownMaps: number;

    favoriteMapper: string;
    favoriteArtist: string;
    favoriteGenre: string;

    uniqueArtists: number;
}

export class CompareProfileViewService extends AbstractViewService<CompareProfileViewDto, ECompareProfileView> {
    protected readonly ttl = 180;

    public build(
        sessionID: string,
        data: CompareProfileViewDto,
        view: ECompareProfileView = ECompareProfileView.Overview,
    ): TMessagePayload {
        const left = this.profileLink(data.left.profile);
        const right = this.profileLink(data.right.profile);

        return {
            content: `Profile comparison: ${left} vs ${right}`,
            embeds: [this.view(data, view)],
            components: this.components(sessionID, data, view),
        };
    }

    //#region Views

    public overview(data: CompareProfileViewDto): Embed {
        const left = data.left;
        const right = data.right;

        const leftStats = left.profile.statistics;
        const rightStats = right.profile.statistics;

        const leftPeak = this.peakRank(left);
        const rightPeak = this.peakRank(right);

        const leftPCPeak = UserAttributesCalculator.peakMonthlyPlaycount(left.profile);
        const rightPCPeak = UserAttributesCalculator.peakMonthlyPlaycount(right.profile);

        const leftMonthlyPC = UserAttributesCalculator.averageMonthlyPlaycount(left.profile);
        const rightMonthlyPC = UserAttributesCalculator.averageMonthlyPlaycount(right.profile);

        const leftPPMonth = UserAttributesCalculator.ppPerAccountMonth(left.profile);
        const rightPPMonth = UserAttributesCalculator.ppPerAccountMonth(right.profile);

        const leftWatched = UserAttributesCalculator.watchedReplays(left.profile);
        const rightWatched = UserAttributesCalculator.watchedReplays(right.profile);

        const rows: Array<ICompareRow> = [
            this.compareRow(
                "Global Rank",
                this.rankOrNA(leftStats.globalRank),
                this.rankOrNA(rightStats.globalRank),
                this.validRank(leftStats.globalRank),
                this.validRank(rightStats.globalRank),
                "lower",
            ),
            this.compareRow(
                "Country Rank",
                this.rankOrNA(leftStats.countryRank),
                this.rankOrNA(rightStats.countryRank),
                this.validRank(leftStats.countryRank),
                this.validRank(rightStats.countryRank),
                "lower",
            ),
            this.compareRow("Peak Rank", leftPeak.display, rightPeak.display, leftPeak.rank, rightPeak.rank, "lower"),
            this.compareRow("Peak Date", leftPeak.date, rightPeak.date),
            this.compareRow(
                "PP",
                ProfileFormatter.pp(leftStats.pp),
                ProfileFormatter.pp(rightStats.pp),
                leftStats.pp,
                rightStats.pp,
                "higher",
            ),
            this.compareRow(
                "Accuracy",
                ProfileFormatter.accuracy(leftStats.accuracy),
                ProfileFormatter.accuracy(rightStats.accuracy),
                leftStats.accuracy,
                rightStats.accuracy,
                "higher",
            ),
            this.compareRow(
                "Level",
                ProfileFormatter.level(leftStats.level.current, leftStats.level.progress),
                ProfileFormatter.level(rightStats.level.current, rightStats.level.progress),
                leftStats.level.current + leftStats.level.progress / 100,
                rightStats.level.current + rightStats.level.progress / 100,
                "higher",
            ),
            this.compareRow(
                "Playtime",
                ProfileFormatter.playtime(leftStats.playtime),
                ProfileFormatter.playtime(rightStats.playtime),
            ),
            this.compareRow(
                "Playcount",
                DiscordFormatter.number(leftStats.playcount),
                DiscordFormatter.number(rightStats.playcount),
            ),
            this.compareRow(
                "PC Peak",
                leftPCPeak ? DiscordFormatter.number(leftPCPeak.count) : "—",
                rightPCPeak ? DiscordFormatter.number(rightPCPeak.count) : "—",
                leftPCPeak?.count,
                rightPCPeak?.count,
                "higher",
            ),
            this.compareRow(
                "PC Peak Month",
                this.monthOrNA(leftPCPeak?.startDate),
                this.monthOrNA(rightPCPeak?.startDate),
            ),
            this.compareRow("Avg Monthly PC", this.numberOrNA(leftMonthlyPC, 0), this.numberOrNA(rightMonthlyPC, 0)),
            this.compareRow(
                "PP / Acc Month",
                this.ppOrNA(leftPPMonth),
                this.ppOrNA(rightPPMonth),
                leftPPMonth,
                rightPPMonth,
                "higher",
            ),

            this.compareRow(
                "Join Date",
                DateFormatter.iso(left.profile.joinDate),
                DateFormatter.iso(right.profile.joinDate),
            ),
            this.compareRow(
                "Medals",
                DiscordFormatter.number(left.profile.achievements?.length ?? 0),
                DiscordFormatter.number(right.profile.achievements?.length ?? 0),
            ),
            this.compareRow(
                "Badges",
                DiscordFormatter.number(left.profile.badges?.length ?? 0),
                DiscordFormatter.number(right.profile.badges?.length ?? 0),
            ),
            this.compareRow(
                "Followers",
                DiscordFormatter.number(left.profile.followers),
                DiscordFormatter.number(right.profile.followers),
            ),
            this.compareRow(
                "Replays Watched",
                DiscordFormatter.number(leftWatched),
                DiscordFormatter.number(rightWatched),
            ),
        ];

        return new Embed().setDescription(this.renderTable(data, rows));
    }

    public performance(data: CompareProfileViewDto): Embed {
        const left = data.left;
        const right = data.right;

        const leftStats = left.profile.statistics;
        const rightStats = right.profile.statistics;

        const leftPeak = this.peakRank(left);
        const rightPeak = this.peakRank(right);

        const leftTop1 = ScoresAttributesCalculator.ppAt(left.scores, 0);
        const rightTop1 = ScoresAttributesCalculator.ppAt(right.scores, 0);

        const leftTop10 = ScoresAttributesCalculator.ppAt(left.scores, 9);
        const rightTop10 = ScoresAttributesCalculator.ppAt(right.scores, 9);

        const leftTop50 = ScoresAttributesCalculator.ppAt(left.scores, 49);
        const rightTop50 = ScoresAttributesCalculator.ppAt(right.scores, 49);

        const leftTop100 = ScoresAttributesCalculator.ppAt(left.scores, 99);
        const rightTop100 = ScoresAttributesCalculator.ppAt(right.scores, 99);

        const leftSpread = ScoresAttributesCalculator.ppSpread(left.scores, 99);
        const rightSpread = ScoresAttributesCalculator.ppSpread(right.scores, 99);

        const leftAverage = ScoresAttributesCalculator.averagePP(left.scores);
        const rightAverage = ScoresAttributesCalculator.averagePP(right.scores);

        const leftMedian = ScoresAttributesCalculator.medianPP(left.scores);
        const rightMedian = ScoresAttributesCalculator.medianPP(right.scores);

        const leftWeighted = ScoresAttributesCalculator.weightedPP(left.scores);
        const rightWeighted = ScoresAttributesCalculator.weightedPP(right.scores);

        const leftNoMiss = ScoresAttributesCalculator.noMissPercentage(left.scores);
        const rightNoMiss = ScoresAttributesCalculator.noMissPercentage(right.scores);

        const leftTopAcc = ScoresAttributesCalculator.averageAccuracy(left.scores);
        const rightTopAcc = ScoresAttributesCalculator.averageAccuracy(right.scores);

        const leftHours = leftStats.playtime / 3600;
        const rightHours = rightStats.playtime / 3600;

        const leftPPHour = leftHours > 0 ? leftStats.pp / leftHours : null;
        const rightPPHour = rightHours > 0 ? rightStats.pp / rightHours : null;

        const leftPP1000 = leftStats.playcount > 0 ? (leftStats.pp / leftStats.playcount) * 1000 : null;
        const rightPP1000 = rightStats.playcount > 0 ? (rightStats.pp / rightStats.playcount) * 1000 : null;

        const rows: Array<ICompareRow> = [
            this.compareRow(
                "Current PP",
                ProfileFormatter.pp(leftStats.pp),
                ProfileFormatter.pp(rightStats.pp),
                leftStats.pp,
                rightStats.pp,
                "higher",
            ),
            this.compareRow(
                "Global Rank",
                this.rankOrNA(leftStats.globalRank),
                this.rankOrNA(rightStats.globalRank),
                this.validRank(leftStats.globalRank),
                this.validRank(rightStats.globalRank),
                "lower",
            ),
            this.compareRow("Peak Rank", leftPeak.display, rightPeak.display, leftPeak.rank, rightPeak.rank, "lower"),
            this.compareRow("Top #1 PP", this.ppOrNA(leftTop1), this.ppOrNA(rightTop1), leftTop1, rightTop1, "higher"),
            this.compareRow(
                "Top #10 PP",
                this.ppOrNA(leftTop10),
                this.ppOrNA(rightTop10),
                leftTop10,
                rightTop10,
                "higher",
            ),
            this.compareRow(
                "Top #50 PP",
                this.ppOrNA(leftTop50),
                this.ppOrNA(rightTop50),
                leftTop50,
                rightTop50,
                "higher",
            ),
            this.compareRow(
                "Top #100 PP",
                this.ppOrNA(leftTop100),
                this.ppOrNA(rightTop100),
                leftTop100,
                rightTop100,
                "higher",
            ),
            this.compareRow("PP Spread", this.ppOrNA(leftSpread), this.ppOrNA(rightSpread)),
            this.compareRow(
                "Avg Top PP",
                this.ppOrNA(leftAverage),
                this.ppOrNA(rightAverage),
                leftAverage,
                rightAverage,
                "higher",
            ),
            this.compareRow(
                "Median Top PP",
                this.ppOrNA(leftMedian),
                this.ppOrNA(rightMedian),
                leftMedian,
                rightMedian,
                "higher",
            ),
            this.compareRow(
                "Weighted Top PP",
                this.ppOrNA(leftWeighted),
                this.ppOrNA(rightWeighted),
                leftWeighted,
                rightWeighted,
                "higher",
            ),
            this.compareRow(
                "Bonus PP (est.)",
                ProfileFormatter.pp(UserAttributesCalculator.bonus(left.profile)),
                ProfileFormatter.pp(UserAttributesCalculator.bonus(right.profile)),
            ),
            this.compareRow(
                "PP / Play Hour",
                this.ppOrNA(leftPPHour),
                this.ppOrNA(rightPPHour),
                leftPPHour,
                rightPPHour,
                "higher",
            ),
            this.compareRow(
                "PP / 1k Plays",
                this.ppOrNA(leftPP1000),
                this.ppOrNA(rightPP1000),
                leftPP1000,
                rightPP1000,
                "higher",
            ),
            this.compareRow(
                "Recommended SR",
                MapFormatter.stars(UserAttributesCalculator.recommended(left.profile), false),
                MapFormatter.stars(UserAttributesCalculator.recommended(right.profile), false),
            ),
            this.compareRow(
                "Top Avg Accuracy",
                this.percentOrNA(leftTopAcc),
                this.percentOrNA(rightTopAcc),
                leftTopAcc,
                rightTopAcc,
                "higher",
            ),
            this.compareRow(
                "No-Miss Top Plays",
                this.percentOrNA(leftNoMiss, 1),
                this.percentOrNA(rightNoMiss, 1),
                leftNoMiss,
                rightNoMiss,
                "higher",
            ),
            this.compareRow(
                "Top Scores",
                DiscordFormatter.number(left.scores.length),
                DiscordFormatter.number(right.scores.length),
            ),
        ];

        return new Embed().setDescription(this.renderTable(data, rows));
    }

    public top100(data: CompareProfileViewDto): Embed {
        if (!data.left.populated || !data.right.populated) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "Top 100 comparison is unavailable without populated scores.",
            );
        }

        const leftScores = data.left.populated;
        const rightScores = data.right.populated;

        const left = ScoresAttributesCalculator.average(leftScores);
        const right = ScoresAttributesCalculator.average(rightScores);

        const rows: Array<ICompareRow> = [
            this.compareRow(
                "Avg PP",
                this.ppOrNA(leftScores.length ? left.pp.avg : null),
                this.ppOrNA(rightScores.length ? right.pp.avg : null),
                leftScores.length ? left.pp.avg : null,
                rightScores.length ? right.pp.avg : null,
                "higher",
            ),
            this.compareRow(
                "Avg Acc",
                leftScores.length ? this.accuracyOrNA(left.accuracy.avg) : "—",
                rightScores.length ? this.accuracyOrNA(right.accuracy.avg) : "—",
                leftScores.length ? left.accuracy.avg : null,
                rightScores.length ? right.accuracy.avg : null,
                "higher",
            ),
            this.compareRow(
                "Avg Combo",
                leftScores.length ? ProfileFormatter.combo(Math.round(left.combo.avg)) : "—",
                rightScores.length ? ProfileFormatter.combo(Math.round(right.combo.avg)) : "—",
                leftScores.length ? left.combo.avg : null,
                rightScores.length ? right.combo.avg : null,
                "higher",
            ),
            this.compareRow(
                "Avg Miss",
                leftScores.length ? this.numberOrNA(left.miss.avg, 2) : "—",
                rightScores.length ? this.numberOrNA(right.miss.avg, 2) : "—",
                leftScores.length ? left.miss.avg : null,
                rightScores.length ? right.miss.avg : null,
                "lower",
            ),
            this.compareRow(
                "Avg SR",
                leftScores.length ? MapFormatter.stars(left.stars.avg, false) : "—",
                rightScores.length ? MapFormatter.stars(right.stars.avg, false) : "—",
            ),
            this.compareRow(
                "Avg BPM",
                leftScores.length ? this.numberOrNA(left.bpm.avg) : "—",
                rightScores.length ? this.numberOrNA(right.bpm.avg) : "—",
            ),
            this.compareRow(
                "Avg Length",
                leftScores.length ? MapFormatter.length(left.length.avg) : "—",
                rightScores.length ? MapFormatter.length(right.length.avg) : "—",
            ),
            ...this.averageDifficultyRows(data.left.profile.mode, left, right, leftScores.length, rightScores.length),
            this.compareRow(
                "Max PP",
                this.ppOrNA(leftScores.length ? left.pp.max : null),
                this.ppOrNA(rightScores.length ? right.pp.max : null),
                leftScores.length ? left.pp.max : null,
                rightScores.length ? right.pp.max : null,
                "higher",
            ),
            this.compareRow(
                "Min PP",
                this.ppOrNA(leftScores.length ? left.pp.min : null),
                this.ppOrNA(rightScores.length ? right.pp.min : null),
                leftScores.length ? left.pp.min : null,
                rightScores.length ? right.pp.min : null,
                "higher",
            ),
            this.compareRow(
                "Max SR",
                leftScores.length ? MapFormatter.stars(left.stars.max, false) : "—",
                rightScores.length ? MapFormatter.stars(right.stars.max, false) : "—",
            ),
            this.compareRow(
                "Min SR",
                leftScores.length ? MapFormatter.stars(left.stars.min, false) : "—",
                rightScores.length ? MapFormatter.stars(right.stars.min, false) : "—",
            ),
            this.compareRow(
                "Max BPM",
                leftScores.length ? this.numberOrNA(left.bpm.max) : "—",
                rightScores.length ? this.numberOrNA(right.bpm.max) : "—",
            ),
            this.compareRow(
                "Min BPM",
                leftScores.length ? this.numberOrNA(left.bpm.min) : "—",
                rightScores.length ? this.numberOrNA(right.bpm.min) : "—",
            ),
            this.compareRow(
                "Max Length",
                leftScores.length ? MapFormatter.length(left.length.max) : "—",
                rightScores.length ? MapFormatter.length(right.length.max) : "—",
            ),
            this.compareRow(
                "Min Length",
                leftScores.length ? MapFormatter.length(left.length.min) : "—",
                rightScores.length ? MapFormatter.length(right.length.min) : "—",
            ),
        ];

        return new Embed().setDescription(this.renderTable(data, rows));
    }

    public scores(data: CompareProfileViewDto): Embed {
        const left = data.left.profile;
        const right = data.right.profile;

        const l = left.statistics;
        const r = right.statistics;

        const leftMissRate = this.profileMissRate(left);
        const rightMissRate = this.profileMissRate(right);

        const leftRankedShare = l.totalScore > 0 ? (l.rankedScore / l.totalScore) * 100 : null;
        const rightRankedShare = r.totalScore > 0 ? (r.rankedScore / r.totalScore) * 100 : null;

        const leftHitsPlay = l.playcount > 0 ? l.totalHits / l.playcount : null;
        const rightHitsPlay = r.playcount > 0 ? r.totalHits / r.playcount : null;

        const left300100 = this.safeRatio(l.count300, l.count100);
        const right300100 = this.safeRatio(r.count300, r.count100);

        const left300Miss = this.safeRatio(l.count300, l.countMiss);
        const right300Miss = this.safeRatio(r.count300, r.countMiss);

        const rows: Array<ICompareRow> = [
            this.compareRow(
                "Ranked Score",
                DiscordFormatter.number(l.rankedScore),
                DiscordFormatter.number(r.rankedScore),
                l.rankedScore,
                r.rankedScore,
                "higher",
            ),
            this.compareRow(
                "Total Score",
                DiscordFormatter.number(l.totalScore),
                DiscordFormatter.number(r.totalScore),
                l.totalScore,
                r.totalScore,
                "higher",
            ),
            this.compareRow("Ranked / Total", this.percentOrNA(leftRankedShare), this.percentOrNA(rightRankedShare)),
            this.compareRow(
                "Total Hits",
                DiscordFormatter.number(l.totalHits),
                DiscordFormatter.number(r.totalHits),
                l.totalHits,
                r.totalHits,
                "higher",
            ),
            this.compareRow("Hits / Play", this.numberOrNA(leftHitsPlay, 1), this.numberOrNA(rightHitsPlay, 1)),
            this.compareRow(
                "Max Combo",
                ProfileFormatter.combo(l.maxCombo),
                ProfileFormatter.combo(r.maxCombo),
                l.maxCombo,
                r.maxCombo,
                "higher",
            ),
            this.compareRow(
                "Miss Rate",
                this.percentOrNA(leftMissRate, 2),
                this.percentOrNA(rightMissRate, 2),
                leftMissRate,
                rightMissRate,
                "lower",
            ),
            this.compareRow(
                "300s",
                DiscordFormatter.number(l.count300),
                DiscordFormatter.number(r.count300),
                l.count300,
                r.count300,
                "higher",
            ),
            this.compareRow("100s", DiscordFormatter.number(l.count100), DiscordFormatter.number(r.count100)),
            this.compareRow("50s", DiscordFormatter.number(l.count50), DiscordFormatter.number(r.count50)),
            this.compareRow(
                "Misses",
                DiscordFormatter.number(l.countMiss),
                DiscordFormatter.number(r.countMiss),
                l.countMiss,
                r.countMiss,
                "lower",
            ),
            this.compareRow(
                "300 / 100",
                this.ratioOrNA(left300100),
                this.ratioOrNA(right300100),
                left300100,
                right300100,
                "higher",
            ),
            this.compareRow(
                "300 / Miss",
                this.ratioOrNA(left300Miss),
                this.ratioOrNA(right300Miss),
                left300Miss,
                right300Miss,
                "higher",
            ),
            this.compareRow(
                "SSH",
                DiscordFormatter.number(l.grades.ssh),
                DiscordFormatter.number(r.grades.ssh),
                l.grades.ssh,
                r.grades.ssh,
                "higher",
            ),
            this.compareRow(
                "SS",
                DiscordFormatter.number(l.grades.ss),
                DiscordFormatter.number(r.grades.ss),
                l.grades.ss,
                r.grades.ss,
                "higher",
            ),
            this.compareRow(
                "SH",
                DiscordFormatter.number(l.grades.sh),
                DiscordFormatter.number(r.grades.sh),
                l.grades.sh,
                r.grades.sh,
                "higher",
            ),
            this.compareRow(
                "S",
                DiscordFormatter.number(l.grades.s),
                DiscordFormatter.number(r.grades.s),
                l.grades.s,
                r.grades.s,
                "higher",
            ),
            this.compareRow(
                "A",
                DiscordFormatter.number(l.grades.a),
                DiscordFormatter.number(r.grades.a),
                l.grades.a,
                r.grades.a,
                "higher",
            ),
            this.compareRow(
                "First Places",
                DiscordFormatter.number(left.scoresFirstCount),
                DiscordFormatter.number(right.scoresFirstCount),
                left.scoresFirstCount,
                right.scoresFirstCount,
                "higher",
            ),
        ];

        return new Embed().setDescription(this.renderTable(data, rows));
    }

    public activity(data: CompareProfileViewDto): Embed {
        const left = data.left.profile;
        const right = data.right.profile;

        const l = left.statistics;
        const r = right.statistics;

        const leftMonthly = UserAttributesCalculator.averageMonthlyPlaycount(left);
        const rightMonthly = UserAttributesCalculator.averageMonthlyPlaycount(right);

        const left3 = UserAttributesCalculator.averageMonthlyPlaycount(left, 3);
        const right3 = UserAttributesCalculator.averageMonthlyPlaycount(right, 3);

        const left12 = UserAttributesCalculator.averageMonthlyPlaycount(left, 12);
        const right12 = UserAttributesCalculator.averageMonthlyPlaycount(right, 12);

        const leftPCPeak = UserAttributesCalculator.peakMonthlyPlaycount(left);
        const rightPCPeak = UserAttributesCalculator.peakMonthlyPlaycount(right);

        const leftReplayAvg = UserAttributesCalculator.averageMonthlyReplaysWatched(left);
        const rightReplayAvg = UserAttributesCalculator.averageMonthlyReplaysWatched(right);

        const leftReplayPeak = UserAttributesCalculator.peakMonthlyReplaysWatched(left);
        const rightReplayPeak = UserAttributesCalculator.peakMonthlyReplaysWatched(right);

        const leftWatched = UserAttributesCalculator.watchedReplays(left);
        const rightWatched = UserAttributesCalculator.watchedReplays(right);

        const leftHours = l.playtime / 3600;
        const rightHours = r.playtime / 3600;

        const leftPCHour = leftHours > 0 ? l.playcount / leftHours : null;
        const rightPCHour = rightHours > 0 ? r.playcount / rightHours : null;

        const leftTimePlay = l.playcount > 0 ? l.playtime / l.playcount : null;
        const rightTimePlay = r.playcount > 0 ? r.playtime / r.playcount : null;

        const rows: Array<ICompareRow> = [
            this.compareRow("Account Age", DateFormatter.age(left.joinDate), DateFormatter.age(right.joinDate)),
            this.compareRow("Join Date", DateFormatter.iso(left.joinDate), DateFormatter.iso(right.joinDate)),
            this.compareRow(
                "Last Visit",
                left.lastVisit ? DateFormatter.iso(left.lastVisit) : "—",
                right.lastVisit ? DateFormatter.iso(right.lastVisit) : "—",
            ),
            this.compareRow("Playtime", ProfileFormatter.playtime(l.playtime), ProfileFormatter.playtime(r.playtime)),
            this.compareRow("Playcount", DiscordFormatter.number(l.playcount), DiscordFormatter.number(r.playcount)),
            this.compareRow("Avg Monthly PC", this.numberOrNA(leftMonthly, 0), this.numberOrNA(rightMonthly, 0)),
            this.compareRow("Last 3mo PC", this.numberOrNA(left3, 0), this.numberOrNA(right3, 0)),
            this.compareRow("Last 12mo PC", this.numberOrNA(left12, 0), this.numberOrNA(right12, 0)),
            this.compareRow(
                "PC Peak",
                leftPCPeak ? DiscordFormatter.number(leftPCPeak.count) : "—",
                rightPCPeak ? DiscordFormatter.number(rightPCPeak.count) : "—",
                leftPCPeak?.count,
                rightPCPeak?.count,
                "higher",
            ),

            this.compareRow(
                "PC Peak Month",
                this.monthOrNA(leftPCPeak?.startDate),
                this.monthOrNA(rightPCPeak?.startDate),
            ),
            this.compareRow(
                "Active PC Months",
                DiscordFormatter.number(UserAttributesCalculator.activePlaycountMonths(left)),
                DiscordFormatter.number(UserAttributesCalculator.activePlaycountMonths(right)),
            ),
            this.compareRow("Plays / Hour", this.numberOrNA(leftPCHour, 2), this.numberOrNA(rightPCHour, 2)),
            this.compareRow("Playtime / Play", this.lengthOrNA(leftTimePlay), this.lengthOrNA(rightTimePlay)),
            this.compareRow(
                "Replays Watched",
                DiscordFormatter.number(leftWatched),
                DiscordFormatter.number(rightWatched),
            ),
            this.compareRow(
                "Avg Monthly Replays",
                this.numberOrNA(leftReplayAvg, 1),
                this.numberOrNA(rightReplayAvg, 1),
            ),
            this.compareRow(
                "Replay Peak",
                leftReplayPeak ? DiscordFormatter.number(leftReplayPeak.count) : "—",
                rightReplayPeak ? DiscordFormatter.number(rightReplayPeak.count) : "—",
                leftReplayPeak?.count,
                rightReplayPeak?.count,
                "higher",
            ),
            this.compareRow(
                "Replay Peak Month",
                this.monthOrNA(leftReplayPeak?.startDate),
                this.monthOrNA(rightReplayPeak?.startDate),
            ),
        ];

        return new Embed().setDescription(this.renderTable(data, rows));
    }

    public mapping(data: CompareProfileViewDto): Embed {
        if (!data.left.mapped || !data.right.mapped) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "Mapping comparison is unavailable without mapped scores.",
            );
        }

        const left = data.left.profile;
        const right = data.right.profile;

        const l = this.mapperSummary(data.left);
        const r = this.mapperSummary(data.right);

        const rows: Array<ICompareRow> = [
            this.compareRow(
                "Ranked Sets",
                DiscordFormatter.number(left.beatmapsetRankedCount),
                DiscordFormatter.number(right.beatmapsetRankedCount),
            ),
            this.compareRow(
                "Loved Sets",
                DiscordFormatter.number(left.beatmapsetLovedCount),
                DiscordFormatter.number(right.beatmapsetLovedCount),
            ),
            this.compareRow(
                "Pending Sets",
                DiscordFormatter.number(left.beatmapsetPendingCount),
                DiscordFormatter.number(right.beatmapsetPendingCount),
            ),
            this.compareRow(
                "Nominated Sets",
                DiscordFormatter.number(left.beatmapsetNominatedCount),
                DiscordFormatter.number(right.beatmapsetNominatedCount),
            ),
            this.compareRow(
                "Graveyard Sets",
                DiscordFormatter.number(left.beatmapsetGraveyardCount),
                DiscordFormatter.number(right.beatmapsetGraveyardCount),
            ),
            this.compareRow(
                "Guest Maps",
                DiscordFormatter.number(left.beatmapsetGuestCount),
                DiscordFormatter.number(right.beatmapsetGuestCount),
            ),
            this.compareRow(
                "Mapset Favorites",
                DiscordFormatter.number(left.beatmapsetFavoriteCount),
                DiscordFormatter.number(right.beatmapsetFavoriteCount),
            ),
            this.compareRow(
                "Mapping Followers",
                DiscordFormatter.number(left.mappingFollowers),
                DiscordFormatter.number(right.mappingFollowers),
            ),
            this.compareRow(
                "Unique Top Mappers",
                DiscordFormatter.number(l.uniqueMappers),
                DiscordFormatter.number(r.uniqueMappers),
            ),
            this.compareRow(
                "Mapper Variety",
                this.percentOrNA(l.mapperVariety, 0),
                this.percentOrNA(r.mapperVariety, 0),
            ),
            this.compareRow("Own Maps in Top", DiscordFormatter.number(l.ownMaps), DiscordFormatter.number(r.ownMaps)),
            this.compareRow("Fav. Mapper", l.favoriteMapper, r.favoriteMapper),
            this.compareRow(
                "Unique Artists",
                DiscordFormatter.number(l.uniqueArtists),
                DiscordFormatter.number(r.uniqueArtists),
            ),
            this.compareRow("Fav. Artist", l.favoriteArtist, r.favoriteArtist),
            this.compareRow("Fav. Genre", l.favoriteGenre, r.favoriteGenre),
        ];

        return new Embed().setDescription(this.renderTable(data, rows));
    }

    public mods(data: CompareProfileViewDto): Embed {
        const left = ScoresAttributesCalculator.modStatistics(data.left.scores);
        const right = ScoresAttributesCalculator.modStatistics(data.right.scores);

        const leftNM = left.modCombos.find((combo) => combo.combo === "NM")?.percentage ?? 0;
        const rightNM = right.modCombos.find((combo) => combo.combo === "NM")?.percentage ?? 0;

        const rows: Array<ICompareRow> = [
            this.compareRow("No Mod", this.percentOrNA(leftNM, 1), this.percentOrNA(rightNM, 1)),
            this.compareRow("Modded", this.percentOrNA(100 - leftNM, 1), this.percentOrNA(100 - rightNM, 1)),
            this.compareRow(
                "Unique Mods",
                DiscordFormatter.number(left.individualMods.length),
                DiscordFormatter.number(right.individualMods.length),
            ),
            this.compareRow(
                "Unique Combos",
                DiscordFormatter.number(left.modCombos.length),
                DiscordFormatter.number(right.modCombos.length),
            ),
            ...this.modRows(left.individualMods, right.individualMods),
            ...this.modComboRows(left.modCombos, right.modCombos),
            ...this.modPpRows(left.ppByCombo, right.ppByCombo),
        ];

        return new Embed().setDescription(this.renderTable(data, rows));
    }

    public matchmaking(data: CompareProfileViewDto): Embed {
        const left = UserAttributesCalculator.currentMatchmaking(data.left.profile);
        const right = UserAttributesCalculator.currentMatchmaking(data.right.profile);

        if (!left && !right) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "Matchmaking statistics are unavailable for both players.",
            );
        }

        const leftFirstRate = left && left.plays > 0 ? (left.firstPlacements / left.plays) * 100 : null;
        const rightFirstRate = right && right.plays > 0 ? (right.firstPlacements / right.plays) * 100 : null;

        const rows: Array<ICompareRow> = [
            this.compareRow("Season", left?.pool?.name ?? "—", right?.pool?.name ?? "—"),
            this.compareRow(
                "Rating",
                left ? DiscordFormatter.number(left.rating) : "—",
                right ? DiscordFormatter.number(right.rating) : "—",
                left?.rating,
                right?.rating,
                "higher",
            ),
            this.compareRow(
                "Rank",
                left ? ProfileFormatter.rank(left.rank) : "—",
                right ? ProfileFormatter.rank(right.rank) : "—",
                left?.rank,
                right?.rank,
                "lower",
            ),
            this.compareRow(
                "Rank Percent",
                left ? `Top ${DiscordFormatter.fixed(left.rankPercent * 100, 4)}%` : "—",
                right ? `Top ${DiscordFormatter.fixed(right.rankPercent * 100, 4)}%` : "—",
                left?.rankPercent,
                right?.rankPercent,
                "lower",
            ),
            this.compareRow(
                "Plays",
                left ? DiscordFormatter.number(left.plays) : "—",
                right ? DiscordFormatter.number(right.plays) : "—",
            ),
            this.compareRow(
                "Wins",
                left ? DiscordFormatter.number(left.firstPlacements) : "—",
                right ? DiscordFormatter.number(right.firstPlacements) : "—",
                left?.firstPlacements,
                right?.firstPlacements,
                "higher",
            ),
            this.compareRow(
                "Win Rate",
                this.percentOrNA(leftFirstRate, 1),
                this.percentOrNA(rightFirstRate, 1),
                leftFirstRate,
                rightFirstRate,
                "higher",
            ),
            this.compareRow(
                "Status",
                left ? (left.isRatingProvisional ? "Provisional" : "Established") : "—",
                right ? (right.isRatingProvisional ? "Provisional" : "Established") : "—",
            ),
        ];

        return new Embed().setDescription(this.renderTable(data, rows));
    }

    public daily(data: CompareProfileViewDto): Embed {
        const left = data.left.profile.dailyChallenge;
        const right = data.right.profile.dailyChallenge;

        const leftTop10 = left && left.playcount > 0 ? (left.top10p / left.playcount) * 100 : null;
        const rightTop10 = right && right.playcount > 0 ? (right.top10p / right.playcount) * 100 : null;

        const leftTop50 = left && left.playcount > 0 ? (left.top50p / left.playcount) * 100 : null;
        const rightTop50 = right && right.playcount > 0 ? (right.top50p / right.playcount) * 100 : null;

        const rows: Array<ICompareRow> = [
            this.compareRow(
                "Daily Streak",
                left ? DiscordFormatter.number(left.dailyStreakCurrent) : "—",
                right ? DiscordFormatter.number(right.dailyStreakCurrent) : "—",
                left?.dailyStreakCurrent,
                right?.dailyStreakCurrent,
                "higher",
            ),
            this.compareRow(
                "Best Daily",
                left ? DiscordFormatter.number(left.dailyStreakBest) : "—",
                right ? DiscordFormatter.number(right.dailyStreakBest) : "—",
                left?.dailyStreakBest,
                right?.dailyStreakBest,
                "higher",
            ),
            this.compareRow(
                "Weekly Streak",
                left ? DiscordFormatter.number(left.weeklyStreakCurrent) : "—",
                right ? DiscordFormatter.number(right.weeklyStreakCurrent) : "—",
                left?.weeklyStreakCurrent,
                right?.weeklyStreakCurrent,
                "higher",
            ),
            this.compareRow(
                "Best Weekly",
                left ? DiscordFormatter.number(left.weeklyStreakBest) : "—",
                right ? DiscordFormatter.number(right.weeklyStreakBest) : "—",
                left?.weeklyStreakBest,
                right?.weeklyStreakBest,
                "higher",
            ),
            this.compareRow(
                "Challenges",
                left ? DiscordFormatter.number(left.playcount) : "—",
                right ? DiscordFormatter.number(right.playcount) : "—",
                left?.playcount,
                right?.playcount,
                "higher",
            ),
            this.compareRow(
                "Top 10 Count",
                left ? DiscordFormatter.number(left.top10p) : "—",
                right ? DiscordFormatter.number(right.top10p) : "—",
                left?.top10p,
                right?.top10p,
                "higher",
            ),
            this.compareRow(
                "Top 10 Rate",
                this.percentOrNA(leftTop10, 1),
                this.percentOrNA(rightTop10, 1),
                leftTop10,
                rightTop10,
                "higher",
            ),
            this.compareRow(
                "Top 50 Count",
                left ? DiscordFormatter.number(left.top50p) : "—",
                right ? DiscordFormatter.number(right.top50p) : "—",
                left?.top50p,
                right?.top50p,
                "higher",
            ),
            this.compareRow(
                "Top 50 Rate",
                this.percentOrNA(leftTop50, 1),
                this.percentOrNA(rightTop50, 1),
                leftTop50,
                rightTop50,
                "higher",
            ),
            this.compareRow(
                "Last Update",
                left ? DateFormatter.iso(left.lastUpdate) : "—",
                right ? DateFormatter.iso(right.lastUpdate) : "—",
            ),
            this.compareRow(
                "Last Weekly",
                left ? DateFormatter.iso(left.lastWeeklyStreak) : "—",
                right ? DateFormatter.iso(right.lastWeeklyStreak) : "—",
            ),
        ];

        return new Embed().setDescription(this.renderTable(data, rows));
    }

    //#endregion

    //#region Components

    private components(sessionID: string, data: CompareProfileViewDto, view: ECompareProfileView): Array<ActionRow> {
        const menu = new SelectMenu(`osu_profile_compare:${sessionID}`)
            .setCurrent(view)
            .addChoice("Overview", ECompareProfileView.Overview, "General profile comparison")
            .addChoice("Performance", ECompareProfileView.Performance, "PP and top-play performance")
            .addChoice("Top 100", ECompareProfileView.Top100, "Calculated top 100 statistics")
            .addChoice("Scores", ECompareProfileView.Scores, "Lifetime score statistics");

        if (
            UserAttributesCalculator.currentMatchmaking(data.left.profile) ||
            UserAttributesCalculator.currentMatchmaking(data.right.profile)
        ) {
            menu.addChoice("Matchmaking", ECompareProfileView.Matchmaking, "Ranked Play matchmaking statistics");
        }

        menu.addChoice("Activity", ECompareProfileView.Activity, "Play activity and account history")
            .addChoice("Mapping", ECompareProfileView.Mapping, "Mapping and top-play mapper statistics")
            .addChoice("Mods", ECompareProfileView.Mods, "Top-play mod preferences");

        if (data.left.profile.dailyChallenge || data.right.profile.dailyChallenge) {
            menu.addChoice("Daily", ECompareProfileView.Daily, "Daily challenge statistics");
        }

        return [new ActionRow().add(menu)];
    }

    //#endregion

    //#region Routing

    private view(data: CompareProfileViewDto, view: ECompareProfileView): Embed {
        switch (view) {
            case ECompareProfileView.Performance:
                return this.performance(data);
            case ECompareProfileView.Top100:
                return this.top100(data);
            case ECompareProfileView.Matchmaking:
                return this.matchmaking(data);
            case ECompareProfileView.Activity:
                return this.activity(data);
            case ECompareProfileView.Scores:
                return this.scores(data);
            case ECompareProfileView.Mapping:
                return this.mapping(data);
            case ECompareProfileView.Mods:
                return this.mods(data);
            case ECompareProfileView.Daily:
                return this.daily(data);
            case ECompareProfileView.Overview:
            default:
                return this.overview(data);
        }
    }

    //#endregion

    //#region Table

    private renderTable(data: CompareProfileViewDto, rows: ReadonlyArray<ICompareRow>): string {
        const tableRows = rows.map((row) => ({
            ...row,
            left: TextFormatter.truncate(row.left, 20, "…"),
            right: TextFormatter.truncate(row.right, 20, "…"),
        }));

        const table = new AsciiTable<ICompareRow>({
            padding: 1,

            borders: {
                left: false,
                right: false,
                top: false,
                bottom: false,
                vertical: "|",
                horizontal: "-",
                intersection: "+",
                headerSeparator: true,
            },

            columns: [
                {
                    header: TextFormatter.truncate(data.left.profile.username, 20, "…"),
                    accessor: "left",
                    align: "right",
                    headerAlign: "center",
                },
                {
                    header: ProfileFormatter.mode(data.left.profile.mode),
                    accessor: (row) => this.decorateMetric(row),
                    align: "center",
                    headerAlign: "center",
                },
                {
                    header: TextFormatter.truncate(data.right.profile.username, 20, "…"),
                    accessor: "right",
                    align: "left",
                    headerAlign: "center",
                },
            ],
        });

        const plain = table.generate(tableRows);
        return ["```ansi", this.applyAnsi(plain), "```"].join("\n");
    }

    private decorateMetric(row: ICompareRow): string {
        if (
            !row.direction ||
            row.leftValue === null ||
            row.leftValue === undefined ||
            row.rightValue === null ||
            row.rightValue === undefined ||
            !Number.isFinite(row.leftValue) ||
            !Number.isFinite(row.rightValue) ||
            row.leftValue === row.rightValue
        ) {
            return row.metric;
        }

        const leftWins = row.direction === "higher" ? row.leftValue > row.rightValue : row.leftValue < row.rightValue;
        return leftWins ? `◀ ${row.metric}` : `${row.metric} ▶`;
    }

    private applyAnsi(value: string): string {
        const green = "\u001b[0;32m";
        const reset = "\u001b[0m";

        return value.replaceAll("◀", `${green}◀${reset}`).replaceAll("▶", `${green}▶${reset}`);
    }

    private compareRow(
        metric: string,
        left: string,
        right: string,
        leftValue?: number | null,
        rightValue?: number | null,
        direction?: TComparisonDirection,
    ): ICompareRow {
        return {
            metric,
            left,
            right,
            leftValue,
            rightValue,
            direction,
        };
    }

    //#endregion

    //#region Profile helpers

    private peakRank(player: CompareProfilePlayerDto): {
        rank: number | null;
        display: string;
        date: string;
    } {
        const profileRank = player.profile.highestRank?.rank;
        const trackRank = player.osutrack?.peakRank;

        const validProfile = profileRank && profileRank > 0 ? profileRank : null;

        const validTrack = trackRank && trackRank > 0 ? trackRank : null;

        let rank: number | null = null;
        let date: Date | string | undefined;

        if (validTrack !== null && (validProfile === null || validTrack < validProfile)) {
            rank = validTrack;
            date = player.osutrack?.peakRankDate;
        } else if (validProfile !== null) {
            rank = validProfile;
            date = player.profile.highestRank?.updatedAt;
        }

        if (rank === null) {
            return {
                rank: null,
                display: "—",
                date: "—",
            };
        }

        return {
            rank,
            display: this.rankOrNA(rank),
            date: date ? DateFormatter.monthYear(date) : "—",
        };
    }

    private profileMissRate(profile: CompareProfilePlayerDto["profile"]): number | null {
        const stats = profile.statistics;
        const total = stats.count300 + stats.count100 + stats.count50 + stats.countMiss;

        if (total <= 0) {
            return null;
        }

        return (stats.countMiss / total) * 100;
    }

    //#endregion

    //#region Mapping

    private mapperSummary(player: CompareProfilePlayerDto): IMapperSummary {
        const scores = player.mapped ?? [];

        const mapperCounts = new Map<string, number>();
        const artistCounts = new Map<string, number>();
        const genreCounts = new Map<string, number>();

        let ownMaps = 0;

        for (const score of scores) {
            const set = score.beatmapset;

            if (!set) {
                continue;
            }

            mapperCounts.set(set.creator, (mapperCounts.get(set.creator) ?? 0) + 1);
            artistCounts.set(set.artist, (artistCounts.get(set.artist) ?? 0) + 1);

            const genre = String(set.genre);

            genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);

            if (set.creator.toLowerCase() === player.profile.username.toLowerCase()) {
                ownMaps++;
            }
        }

        return {
            uniqueMappers: mapperCounts.size,
            mapperVariety: scores.length > 0 ? (mapperCounts.size / scores.length) * 100 : 0,
            ownMaps,
            favoriteMapper: this.favoriteEntry(mapperCounts) ?? "—",
            favoriteArtist: this.favoriteEntry(artistCounts) ?? "—",
            favoriteGenre: this.favoriteEntry(genreCounts) ?? "—",
            uniqueArtists: artistCounts.size,
        };
    }

    private favoriteEntry(values: ReadonlyMap<string, number>): string | null {
        let best: [string, number] | null = null;

        for (const entry of values.entries()) {
            if (!best || entry[1] > best[1] || (entry[1] === best[1] && entry[0].localeCompare(best[0]) < 0)) {
                best = entry;
            }
        }

        if (!best) {
            return null;
        }

        const [name, count] = best;
        const formattedName = TextFormatter.truncate(name, 14);

        return `${formattedName} (${count})`;
    }

    //#endregion

    //#region Mods

    private modRows(
        left: Array<{
            acronym: string;
            count: number;
            percentage: number;
        }>,
        right: Array<{
            acronym: string;
            count: number;
            percentage: number;
        }>,
    ): Array<ICompareRow> {
        const rows: Array<ICompareRow> = [];

        for (let i = 0; i < 3; i++) {
            const l = left[i];
            const r = right[i];
            const placement = i + 1;

            rows.push(this.compareRow(`#${placement} Mod`, l?.acronym ?? "—", r?.acronym ?? "—"));

            rows.push(
                this.compareRow(
                    `#${placement} Mod Use`,
                    l ? this.percentOrNA(l.percentage, 1) : "—",
                    r ? this.percentOrNA(r.percentage, 1) : "—",
                ),
            );
        }

        return rows;
    }

    private modComboRows(
        left: Array<{
            combo: string;
            count: number;
            percentage: number;
        }>,
        right: Array<{
            combo: string;
            count: number;
            percentage: number;
        }>,
    ): Array<ICompareRow> {
        const rows: Array<ICompareRow> = [];

        for (let i = 0; i < 3; i++) {
            const l = left[i];
            const r = right[i];
            const placement = i + 1;

            rows.push(this.compareRow(`#${placement} Combo`, l?.combo ?? "—", r?.combo ?? "—"));

            rows.push(
                this.compareRow(
                    `#${placement} Combo Use`,
                    l ? this.percentOrNA(l.percentage, 1) : "—",
                    r ? this.percentOrNA(r.percentage, 1) : "—",
                ),
            );
        }

        return rows;
    }

    private modPpRows(
        left: Array<{
            combo: string;
            totalWeightedPP: number;
        }>,
        right: Array<{
            combo: string;
            totalWeightedPP: number;
        }>,
    ): Array<ICompareRow> {
        const rows: Array<ICompareRow> = [];

        for (let i = 0; i < 3; i++) {
            const l = left[i];
            const r = right[i];
            const placement = i + 1;

            rows.push(this.compareRow(`#${placement} PP Combo`, l?.combo ?? "—", r?.combo ?? "—"));

            rows.push(
                this.compareRow(
                    `#${placement} Combo PP`,
                    l ? this.ppOrNA(l.totalWeightedPP) : "—",
                    r ? this.ppOrNA(r.totalWeightedPP) : "—",
                ),
            );
        }

        return rows;
    }

    //#endregion

    //#region Top 100 helpers

    private averageDifficultyRows(
        mode: GameMode,
        left: PopulatedScoreAverageDto,
        right: PopulatedScoreAverageDto,
        leftCount: number,
        rightCount: number,
    ): Array<ICompareRow> {
        const row = (metric: string, key: "ar" | "cs" | "od" | "hp"): ICompareRow =>
            this.compareRow(
                metric,
                leftCount ? this.numberOrNA(left[key].avg, 2) : "—",
                rightCount ? this.numberOrNA(right[key].avg, 2) : "—",
            );

        switch (mode) {
            case GameMode.Taiko:
                return [row("Avg OD", "od"), row("Avg HP", "hp")];
            case GameMode.Mania:
                return [row("Avg Keys", "cs"), row("Avg OD", "od"), row("Avg HP", "hp")];
            default:
                return [row("Avg AR", "ar"), row("Avg CS", "cs"), row("Avg OD", "od"), row("Avg HP", "hp")];
        }
    }

    //#endregion

    //#region Formatting

    private validRank(rank?: number | null): number | null {
        return rank && rank > 0 ? rank : null;
    }

    private numberOrNA(value?: number | null, decimals: number = 0): string {
        if (!isValidNumber(value)) {
            return "—";
        }

        const formatted = DiscordFormatter.fixed(value, decimals);
        return DiscordFormatter.number(formatted);
    }

    private ppOrNA(value?: number | null): string {
        return isValidNumber(value) ? ProfileFormatter.pp(value) : "—";
    }

    private rankOrNA(rank?: number | null): string {
        return rank && rank > 0 ? ProfileFormatter.rank(rank) : "—";
    }

    private percentOrNA(value?: number | null, decimals: number = 2): string {
        return isValidNumber(value) ? `${DiscordFormatter.fixed(value, decimals)}%` : "—";
    }

    private accuracyOrNA(value?: number | null): string {
        return isValidNumber(value) ? ProfileFormatter.accuracy(value) : "—";
    }

    private ratioOrNA(value?: number | null): string {
        return this.numberOrNA(value, 2);
    }

    private safeRatio(numerator: number, denominator: number): number | null {
        if (denominator <= 0) {
            return null;
        }

        return numerator / denominator;
    }

    private monthOrNA(value?: Date | string | null): string {
        return value ? DateFormatter.monthYear(value) : "—";
    }

    private lengthOrNA(value?: number | null): string {
        return isValidNumber(value) ? MapFormatter.length(value) : "—";
    }

    //#endregion

    private profileLink(profile: PopulatedUser): string {
        return DiscordFormatter.link(
            profile.username,
            ProfileFormatter.link(profile.provider, profile.id, profile.mode),
            null,
            true,
        );
    }
}
