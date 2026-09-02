import { AbstractService } from "@/core/framework/AbstractService";
import { EMatchCostTeam } from "@domain/osu/enums/MatchCost.enum";
import {
    MatchCostCalculationDto,
    MatchCostGameDto,
    MatchCostMatchDto,
    MatchCostPlayerResultDto,
    MatchCostScoreDto,
    MatchCostTeamScoreDto,
} from "@domain/osu/MatchCost.dto";

interface IPlayerAccumulator {
    weightedRatioSum: number;
    totalWeight: number;
    gamesPlayed: number;
    teams: Map<EMatchCostTeam, number>;
}

export class MatchCostEvaluatorService extends AbstractService {
    /**
     * Low-sample performances are pulled towards the neutral 1.0 baseline.
     * A weight of 2 is equivalent to adding two hypothetical average maps, enough to tame one-map outliers
     * without erasing strong substitutes.
     */
    private readonly priorWeight = 2;

    /**
     * Participation is deliberately a small part of match cost, as we want to value performance more than just being present.
     * This ranges from roughly 0.90x for minimal participation to exactly 1.00x for playing every evaluated map.
     */
    private readonly participationBase = 0.9;
    private readonly participationWeight = 0.1;

    /**
     * A tiebreaker carries 15% more weight because performance on the deciding map is more consequential,
     * while remaining close enough to a normal map that one tiebreaker cannot dominate an otherwise long match.
     */
    private readonly tiebreakerWeight = 1.15;

    /**
     * Rewards above-average performances that were actually necessary to secure a team win.
     * At maximum criticality, only the portion above the 1.0 average baseline receives a 30% bonus.
     */
    private readonly teamImpactWeight = 0.3;

    /**
     * Internal match cost naturally clusters around 1.0, which is not visually interesting to players.
     * We display average performance around 2.0 and amplify deviations by 3x without changing player ordering.
     */
    private readonly matchCostBase = 2;
    private readonly matchCostSpread = 3;

    public evaluate(
        match: MatchCostMatchDto,
        warmups: number,
        skip: number,
        ezMultiplier: number,
    ): MatchCostCalculationDto {
        const sortedGames = [...match.games].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

        /**
         * Warmups never contributed to the competitive score, so they are removed before
         * any tiebreaker or performance evaluation.
         */
        const gamesAfterWarmups = sortedGames.slice(warmups);

        /**
         * Tiebreaker detection happens before `skip`: removing the actual final map should not retroactively turn
         * the previous map into a tiebreaker just because it became the last map in the evaluated slice.
         */
        const tiebreakerGameID = match.teamVs
            ? this.resolveTiebreakerGameID(gamesAfterWarmups, match.ended, ezMultiplier)
            : undefined;

        const games = skip > 0 ? gamesAfterWarmups.slice(0, -skip) : gamesAfterWarmups;

        const accumulators = new Map<number, IPlayerAccumulator>();
        let evaluatedGames = 0;

        for (const game of games) {
            const evaluated = this.evaluateGame(
                game,
                accumulators,
                ezMultiplier,
                game.id === tiebreakerGameID,
                match.teamVs,
            );

            if (evaluated) {
                evaluatedGames++;
            }
        }

        const players = this.evaluatePlayers(match, accumulators, evaluatedGames);
        const teamScore = match.teamVs ? this.evaluateTeamScore(games, ezMultiplier) : undefined;

        return {
            teamVs: match.teamVs,
            gamesPlayed: evaluatedGames,
            players,
            teamScore,
        };
    }

    private evaluateGame(
        game: MatchCostGameDto,
        accumulators: Map<number, IPlayerAccumulator>,
        ezMultiplier: number,
        tiebreaker: boolean,
        teamVs: boolean,
    ): boolean {
        if (game.scores.length < 2) {
            return false;
        }

        /**
         * Normalize against the lobby's average adjusted score rather than raw score alone.
         * This makes a player's value relative to how difficult that specific map was for everyone who played it.
         */
        const averageScore =
            game.scores.reduce((total, score) => total + this.score(score, ezMultiplier), 0) / game.scores.length;

        if (averageScore <= 0) {
            return false;
        }

        /**
         * Weight multiplies the map contribution rather than adding a flat tiebreaker bonus,
         * preserving the value of the actual performance.
         */
        const weight = tiebreaker ? this.tiebreakerWeight : 1;
        const winner = teamVs ? this.gameWinner(game, ezMultiplier) : undefined;

        for (const score of game.scores) {
            const accumulator = accumulators.get(score.userID) ?? this.createAccumulator();
            const adjustedScore = this.score(score, ezMultiplier);

            /**
             * 1.0 means exactly lobby average, 1.5 means 50% above average, 0.8 means 20% below.
             * Ratios make performances comparable across maps whose absolute score distributions differ significantly.
             */
            const ratio = adjustedScore / averageScore;

            /**
             * Team impact only rewards above-average performances on the winning team.
             * A player should not gain "clutch" value for merely being part of a close win while performing below average.
             */
            const criticality =
                score.team && score.team === winner && ratio > 1 ? this.teamCriticality(score, game, ezMultiplier) : 0;

            /**
             * Only the performance above 1.0 is amplified. E.g. 1.50 ratio with full criticality gains
             * 0.50 * 1.00 * 0.30 = 0.15, becoming 1.65 instead of applying a blanket 30% boost to the whole score.
             */
            const impactBonus = Math.max(0, ratio - 1) * criticality * this.teamImpactWeight;
            const effectiveRatio = ratio + impactBonus;

            /**
             * Tiebreaker weight is applied equally to the map's positive or negative performance.
             * This makes both clutching and underperforming on the deciding map slightly more consequential.
             */
            accumulator.weightedRatioSum += effectiveRatio * weight;
            accumulator.totalWeight += weight;
            accumulator.gamesPlayed++;

            if (score.team) {
                accumulator.teams.set(score.team, (accumulator.teams.get(score.team) ?? 0) + 1);
            }

            accumulators.set(score.userID, accumulator);
        }

        return true;
    }

    private evaluatePlayers(
        match: MatchCostMatchDto,
        accumulators: Map<number, IPlayerAccumulator>,
        totalGames: number,
    ): Array<MatchCostPlayerResultDto> {
        const players: Array<MatchCostPlayerResultDto> = [];

        for (const user of match.users) {
            const accumulator = accumulators.get(user.id);

            if (!accumulator || accumulator.gamesPlayed === 0 || accumulator.totalWeight === 0) {
                continue;
            }

            /**
             * Divide by total map weight instead of games played because tiebreaker maps contribute 1.15 units of evidence.
             * This keeps the result a weighted average rather than letting extra weight inflate match cost by itself.
             */
            const rawPerformance = accumulator.weightedRatioSum / accumulator.totalWeight;

            /**
             * Shrink uncertain samples towards 1.0 using a small neutral prior.
             * E.g. one huge map is still rewarded, but ten consistently huge maps provide much stronger evidence of true performance.
             */
            const confidenceAdjusted =
                (rawPerformance * accumulator.totalWeight + this.priorWeight) /
                (accumulator.totalWeight + this.priorWeight);

            /**
             * Participation is the fraction of competitive maps actually played. Missing maps are not treated as zero scores.
             * This avoids unfairly destroying substitutes while still giving some credit to sustained performance over a full match.
             */
            const participation = totalGames > 0 ? accumulator.gamesPlayed / totalGames : 0;

            /**
             * Linear scaling keeps every additional played map equally valuable: 0.90 + 0.10 * participation.
             * We intentionally avoid a stronger participation penalty because one exceptional substitute can be more valuable
             * than a full-match bottom scorer.
             */
            const participationFactor = this.participationBase + this.participationWeight * participation;

            const rawMatchCost = confidenceAdjusted * participationFactor;
            const matchCost = this.scaleMatchCost(rawMatchCost);

            players.push({
                userID: user.id,
                username: user.username,
                countryCode: user.countryCode,
                matchCost,
                gamesPlayed: accumulator.gamesPlayed,
                team: this.resolveTeam(accumulator.teams),
            });
        }

        return players.sort((a, b) => b.matchCost - a.matchCost);
    }

    private evaluateTeamScore(games: Array<MatchCostGameDto>, ezMultiplier: number): MatchCostTeamScoreDto {
        let red = 0;
        let blue = 0;

        for (const game of games) {
            const winner = this.gameWinner(game, ezMultiplier);

            if (winner === EMatchCostTeam.Red) {
                red++;
            } else if (winner === EMatchCostTeam.Blue) {
                blue++;
            }
        }

        return {
            red,
            blue,
        };
    }

    /**
     * Measures how much of this player's adjusted score was necessary for the winning margin.
     * 0 means their teammates already win without them. 1 means essentially their entire score was required to secure the map.
     */
    private teamCriticality(score: MatchCostScoreDto, game: MatchCostGameDto, ezMultiplier: number): number {
        if (!score.team) {
            return 0;
        }

        let ownTeamScore = 0;
        let opponentScore = 0;

        for (const gameScore of game.scores) {
            const value = this.score(gameScore, ezMultiplier);

            if (gameScore.team === score.team) {
                ownTeamScore += value;
            } else if (gameScore.team) {
                opponentScore += value;
            }
        }

        if (ownTeamScore <= opponentScore) {
            return 0;
        }

        const playerScore = this.score(score, ezMultiplier);
        if (playerScore <= 0) {
            return 0;
        }

        const teamWithoutPlayer = ownTeamScore - playerScore;

        /**
         * If the rest of the team already wins outright, this player's score was impressive but not necessary for securing the point.
         */
        if (teamWithoutPlayer > opponentScore) {
            return 0;
        }

        /**
         * Required score is the minimum contribution needed to move the teammates' score past the opponent.
         * Dividing it by the player's actual score turns that requirement into a bounded 0..1 measure of how decisive they were.
         */
        const requiredScore = opponentScore - teamWithoutPlayer;

        return Math.min(1, Math.max(0, requiredScore / playerScore));
    }

    /**
     * Without explicit tournament metadata, the final map is inferred as tiebreaker when the series
     * was tied immediately before it. Detection requires an ended match and at least one previous point,
     * avoiding nonsense such as calling a 0-0 -> 1-0 match a tiebreaker.
     */
    private resolveTiebreakerGameID(
        games: Array<MatchCostGameDto>,
        ended: boolean,
        ezMultiplier: number,
    ): number | undefined {
        if (!ended || games.length < 2) {
            return undefined;
        }

        const lastGame = games[games.length - 1];
        if (!lastGame) {
            return undefined;
        }

        let red = 0;
        let blue = 0;

        for (let index = 0; index < games.length - 1; index++) {
            const game = games[index];
            if (!game) {
                continue;
            }

            const winner = this.gameWinner(game, ezMultiplier);
            if (winner === EMatchCostTeam.Red) {
                red++;
            } else if (winner === EMatchCostTeam.Blue) {
                blue++;
            }
        }

        if (red !== blue || red === 0) {
            return undefined;
        }

        const finalWinner = this.gameWinner(lastGame, ezMultiplier);
        return finalWinner ? lastGame.id : undefined;
    }

    private gameWinner(game: MatchCostGameDto, ezMultiplier: number): EMatchCostTeam | undefined {
        let red = 0;
        let blue = 0;
        let hasRed = false;
        let hasBlue = false;

        for (const score of game.scores) {
            const value = this.score(score, ezMultiplier);

            switch (score.team) {
                case EMatchCostTeam.Red:
                    red += value;
                    hasRed = true;
                    break;
                case EMatchCostTeam.Blue:
                    blue += value;
                    hasBlue = true;
                    break;
            }
        }

        if (!hasRed || !hasBlue) {
            return undefined;
        }

        if (red > blue) {
            return EMatchCostTeam.Red;
        }

        if (blue > red) {
            return EMatchCostTeam.Blue;
        }

        return undefined;
    }

    private score(score: MatchCostScoreDto, ezMultiplier: number): number {
        /**
         * EZ is adjusted before map averages, team totals and ratios are calculated so every downstream comparison
         * operates on the same score scale. Applying it later would unfairly boost EZ relative to an unadjusted lobby average.
         */
        return score.easy ? score.score * ezMultiplier : score.score;
    }

    private scaleMatchCost(value: number): number {
        /**
         * Affine scaling keeps 1.0 internal performance at 2.0 displayed match cost while magnifying distance from average.
         * Because this is linear and monotonic, it makes values more expressive without changing player rankings.
         */
        return Math.max(0, this.matchCostBase + (value - 1) * this.matchCostSpread);
    }

    private resolveTeam(teams: Map<EMatchCostTeam, number>): EMatchCostTeam | undefined {
        let result: EMatchCostTeam | undefined;
        let highestCount = 0;

        for (const [team, count] of teams) {
            if (count > highestCount) {
                result = team;
                highestCount = count;
            }
        }

        return result;
    }

    private createAccumulator(): IPlayerAccumulator {
        return {
            weightedRatioSum: 0,
            totalWeight: 0,
            gamesPlayed: 0,
            teams: new Map(),
        };
    }
}
