using Calculator.Protos;
using osu.Game.Beatmaps;
using osu.Game.Rulesets.Catch.Objects;
using osu.Game.Rulesets.Mania.Objects;
using osu.Game.Rulesets.Mods;
using osu.Game.Rulesets.Osu.Objects;
using osu.Game.Rulesets.Scoring;

namespace Calculator.Services;

public class HitResultGeneration
{
    public Dictionary<HitResult, int> Generate(uint rulesetId, IBeatmap beatmap, Mod[] mods, ScoreState score)
    {
        double accuracy = score.HasAccuracy ? score.Accuracy : 1.0;
        int countMiss = score.HasCountMiss ? (int)score.CountMiss : 0;

        int? countMeh = score.HasCount50 ? (int)score.Count50 : null;
        int? countOk = score.HasCount100 ? (int)score.Count100 : null;
        int? countGood = score.HasCountKatu ? (int)score.CountKatu : null;
        int? countGreat = score.HasCount300 ? (int)score.Count300 : null;
        
        int? countLargeTickMisses = score.HasCountLargeTickMisses ? (int)score.CountLargeTickMisses : null;
        int? countSliderTailMisses = score.HasCountSliderTailMisses ? (int)score.CountSliderTailMisses : null;

        return rulesetId switch
        {
            0 => GenerateStandard(beatmap, mods, accuracy, countMiss, countMeh, countOk, countLargeTickMisses, countSliderTailMisses),
            1 => GenerateTaiko(accuracy, beatmap, countMiss, countOk),
            2 => GenerateCatch(beatmap, accuracy, countMiss, countMeh, countOk),
            3 => GenerateMania(beatmap, mods, accuracy, countMiss, countMeh, countOk, countGood, countGreat),
            _ => throw new ArgumentException("Invalid ruleset ID")
        };
    }

    private Dictionary<HitResult, int> GenerateStandard(
        IBeatmap beatmap, Mod[] mods, double accuracy, int countMiss,
        int? countMeh, int? countOk, int? countLargeTickMisses, int? countSliderTailMisses)
    {
        int totalResultCount = beatmap.HitObjects.Count;

        countMiss = Math.Clamp(countMiss, 0, totalResultCount);
        accuracy = Math.Clamp(accuracy, 0, 1);

        bool isClassic = mods.Any(mod => mod.Acronym == "CL");

        int totalLargeTicks = 0;
        int totalSliderEnds = 0;
        int largeTickMisses = 0;
        int sliderTailMisses = 0;

        double objectAccuracy = accuracy;

        if (!isClassic)
        {
            totalLargeTicks = beatmap.HitObjects.Sum(hitObject =>
                hitObject.NestedHitObjects.Count(nested => nested is SliderTick || nested is SliderRepeat));

            totalSliderEnds = beatmap.HitObjects.Count(hitObject => hitObject is Slider);

            largeTickMisses = Math.Clamp(countLargeTickMisses ?? 0, 0, totalLargeTicks);
            sliderTailMisses = Math.Clamp(countSliderTailMisses ?? 0, 0, totalSliderEnds);

            if (countMeh == null && countOk == null)
            {
                double objectMaximum = 6.0 * totalResultCount;
                double nestedMaximum = 0.6 * totalLargeTicks + 3.0 * totalSliderEnds;
                double nestedEarned = 0.6 * (totalLargeTicks - largeTickMisses)
                    + 3.0 * (totalSliderEnds - sliderTailMisses);

                double totalMaximum = objectMaximum + nestedMaximum;
                double targetTotalPoints = accuracy * totalMaximum;
                double requiredObjectPoints = targetTotalPoints - nestedEarned;

                objectAccuracy = objectMaximum > 0 ? Math.Clamp(requiredObjectPoints / objectMaximum, 0, 1) : 1;
            }
        }

        int countGreat;

        if (countMeh != null || countOk != null)
        {
            countGreat = totalResultCount - (countOk ?? 0) - (countMeh ?? 0) - countMiss;
        }
        else
        {
            int relevantResultCount = totalResultCount - countMiss;

            double relevantAccuracy = relevantResultCount == 0
                ? 0
                : objectAccuracy * totalResultCount / relevantResultCount;

            relevantAccuracy = Math.Clamp(relevantAccuracy, 0, 1);

            if (relevantAccuracy >= 0.25)
            {
                double ratio50To100 = Math.Pow(1 - (relevantAccuracy - 0.25) / 0.75, 2);
                double count100Estimate = 6 * relevantResultCount * (1 - relevantAccuracy) / (5 * ratio50To100 + 4);
                double count50Estimate = count100Estimate * ratio50To100;

                countOk = (int)Math.Round(count100Estimate);
                countMeh = (int)Math.Round(count100Estimate + count50Estimate) - countOk.Value;
            }
            else if (relevantAccuracy >= 1.0 / 6)
            {
                double count100Estimate = 6 * relevantResultCount * relevantAccuracy - relevantResultCount;
                double count50Estimate = relevantResultCount - count100Estimate;

                countOk = (int)Math.Round(count100Estimate);
                countMeh = (int)Math.Round(count100Estimate + count50Estimate) - countOk.Value;
            }
            else
            {
                double count50Estimate = 6 * relevantResultCount * relevantAccuracy;

                countOk = 0;
                countMeh = (int)Math.Round(count50Estimate);
                countMiss = totalResultCount - countMeh.Value;
            }

            countGreat = totalResultCount - (countOk ?? 0) - (countMeh ?? 0) - countMiss;
        }

        var result = new Dictionary<HitResult, int>
        {
            [HitResult.Great] = countGreat,
            [HitResult.Ok] = countOk ?? 0,
            [HitResult.Meh] = countMeh ?? 0,
            [HitResult.Miss] = countMiss,
        };

        if (!isClassic)
        {
            result[HitResult.LargeTickHit] = totalLargeTicks - largeTickMisses;
            result[HitResult.LargeTickMiss] = largeTickMisses;
            result[HitResult.SliderTailHit] = totalSliderEnds - sliderTailMisses;
        }

        return result;
    }

    private Dictionary<HitResult, int> GenerateTaiko(double accuracy, IBeatmap beatmap, int countMiss, int? countGood)
    {
        int totalResultCount = beatmap.GetMaxCombo();
        int countGreat;

        if (countGood != null)
        {
            countGreat = (int)(totalResultCount - countGood - countMiss);
        }
        else
        {
            int targetTotal = (int)Math.Round(accuracy * totalResultCount * 2);
            countGreat = targetTotal - (totalResultCount - countMiss);
            countGood = totalResultCount - countGreat - countMiss;
        }

        return new Dictionary<HitResult, int>
        {
            { HitResult.Great, countGreat },
            { HitResult.Ok, countGood ?? 0 },
            { HitResult.Meh, 0 },
            { HitResult.Miss, countMiss }
        };
    }

    private Dictionary<HitResult, int> GenerateCatch(IBeatmap beatmap, double accuracy, int countMiss, int? countMeh, int? countGood)
    {
        int maxCombo = beatmap.GetMaxCombo();
        int maxTinyDroplets = beatmap.HitObjects.OfType<JuiceStream>().Sum(s => s.NestedHitObjects.OfType<TinyDroplet>().Count());
        int maxDroplets = beatmap.HitObjects.OfType<JuiceStream>().Sum(s => s.NestedHitObjects.OfType<Droplet>().Count()) - maxTinyDroplets;
        int maxFruits = beatmap.HitObjects.Sum(h => h is Fruit ? 1 : (h as JuiceStream)?.NestedHitObjects.Count(n => n is Fruit) ?? 0);

        int countDroplets = countGood ?? Math.Max(0, maxDroplets - countMiss);
        int countFruits = maxFruits - (countMiss - (maxDroplets - countDroplets));
        int countTinyDroplets = countMeh ?? (int)Math.Round(accuracy * (maxCombo + maxTinyDroplets)) - countFruits - countDroplets;
        int countTinyMisses = maxTinyDroplets - countTinyDroplets;

        return new Dictionary<HitResult, int>
        {
            { HitResult.Great, countFruits },
            { HitResult.LargeTickHit, countDroplets },
            { HitResult.SmallTickHit, countTinyDroplets },
            { HitResult.SmallTickMiss, countTinyMisses },
            { HitResult.Miss, countMiss }
        };
    }

    private Dictionary<HitResult, int> GenerateMania(
        IBeatmap beatmap, Mod[] mods, double accuracy, int countMiss,
        int? countMeh, int? countOk, int? countGood, int? countGreat)
    {
        int totalHits = beatmap.HitObjects.Count;

        bool isClassic = mods.Any(mod => mod.Acronym == "CL");

        if (!isClassic)
        {
            totalHits += beatmap.HitObjects.Count(hitObject => hitObject is HoldNote);
        }

        accuracy = Math.Clamp(accuracy, 0, 1);
        countMiss = Math.Clamp(countMiss, 0, totalHits);

        if (countMeh != null || countOk != null || countGood != null || countGreat != null)
        {
            int specifiedHits = countMiss + (countMeh ?? 0) + (countOk ?? 0) + (countGood ?? 0) + (countGreat ?? 0);

            if (specifiedHits > totalHits)
            {
                throw new ArgumentException($"Specified mania hit results exceed the map's total hit count of {totalHits}.");
            }

            return new Dictionary<HitResult, int>
            {
                [HitResult.Perfect] = totalHits - specifiedHits,
                [HitResult.Great] = countGreat ?? 0,
                [HitResult.Good] = countGood ?? 0,
                [HitResult.Ok] = countOk ?? 0,
                [HitResult.Meh] = countMeh ?? 0,
                [HitResult.Miss] = countMiss,
            };
        }

        int perfectValue = isClassic ? 300 : 305;
        int nonMissCount = totalHits - countMiss;

        if (nonMissCount == 0)
        {
            return new Dictionary<HitResult, int>
            {
                [HitResult.Perfect] = 0,
                [HitResult.Great] = 0,
                [HitResult.Good] = 0,
                [HitResult.Ok] = 0,
                [HitResult.Meh] = 0,
                [HitResult.Miss] = totalHits,
            };
        }

        int targetPoints = (int)Math.Round(accuracy * totalHits * perfectValue, MidpointRounding.AwayFromZero);
        int minimumPointsWithRequestedMisses = 50 * nonMissCount;

        if (targetPoints < minimumPointsWithRequestedMisses)
        {
            int lowAccuracyMehs = Math.Clamp(
                (int)Math.Round(targetPoints / 50.0, MidpointRounding.AwayFromZero), 0, nonMissCount);

            return new Dictionary<HitResult, int>
            {
                [HitResult.Perfect] = 0,
                [HitResult.Great] = 0,
                [HitResult.Good] = 0,
                [HitResult.Ok] = 0,
                [HitResult.Meh] = lowAccuracyMehs,
                [HitResult.Miss] = totalHits - lowAccuracyMehs,
            };
        }

        int maximumPoints = perfectValue * nonMissCount;

        targetPoints = Math.Clamp(targetPoints, minimumPointsWithRequestedMisses, maximumPoints);

        int generatedPerfects = 0;
        int generatedGreats = 0;
        int generatedGoods = 0;
        int generatedOks = 0;
        int generatedMehs = 0;

        if (!isClassic && targetPoints >= 300 * nonMissCount)
        {
            generatedGreats = ResolveLowerJudgementCount(nonMissCount, targetPoints, upperValue: 305, lowerValue: 300);
            generatedPerfects = nonMissCount - generatedGreats;
        }
        else if (targetPoints >= 200 * nonMissCount)
        {
            generatedGoods = ResolveLowerJudgementCount(nonMissCount, targetPoints, upperValue: 300, lowerValue: 200);
            int upperCount = nonMissCount - generatedGoods;

            if (isClassic)
                generatedPerfects = upperCount;
            else
                generatedGreats = upperCount;
        }
        else if (targetPoints >= 100 * nonMissCount)
        {
            generatedOks = ResolveLowerJudgementCount(nonMissCount, targetPoints, upperValue: 200, lowerValue: 100);
            generatedGoods = nonMissCount - generatedOks;
        }
        else
        {
            generatedMehs = ResolveLowerJudgementCount(nonMissCount, targetPoints, upperValue: 100, lowerValue: 50);
            generatedOks = nonMissCount - generatedMehs;
        }

        return new Dictionary<HitResult, int>
        {
            [HitResult.Perfect] = generatedPerfects,
            [HitResult.Great] = generatedGreats,
            [HitResult.Good] = generatedGoods,
            [HitResult.Ok] = generatedOks,
            [HitResult.Meh] = generatedMehs,
            [HitResult.Miss] = countMiss,
        };
    }

    private static int ResolveLowerJudgementCount(int hitCount, int targetPoints, int upperValue, int lowerValue)
    {
        if (hitCount <= 0)
            return 0;

        if (upperValue <= lowerValue)
        {
            throw new ArgumentOutOfRangeException(
                nameof(upperValue), "The upper judgement value must be greater than the lower judgement value.");
        }

        double exactLowerCount = ((double)upperValue * hitCount - targetPoints) / (upperValue - lowerValue);

        int floorCount = Math.Clamp((int)Math.Floor(exactLowerCount), 0, hitCount);
        int ceilingCount = Math.Clamp((int)Math.Ceiling(exactLowerCount), 0, hitCount);

        long floorPoints = (long)upperValue * (hitCount - floorCount) + (long)lowerValue * floorCount;
        long ceilingPoints = (long)upperValue * (hitCount - ceilingCount) + (long)lowerValue * ceilingCount;

        long floorError = Math.Abs(floorPoints - targetPoints);
        long ceilingError = Math.Abs(ceilingPoints - targetPoints);

        return ceilingError < floorError ? ceilingCount : floorCount;
    }

    public double GetAccuracyForRuleset(uint rulesetId, IBeatmap beatmap, Dictionary<HitResult, int> statistics, Mod[] mods)
    {
        return rulesetId switch
        {
            0 => GetOsuAccuracy(beatmap, statistics),
            1 => GetTaikoAccuracy(statistics),
            2 => GetCatchAccuracy(statistics),
            3 => GetManiaAccuracy(statistics, mods),
            _ => 0.0
        };
    }

    private double GetOsuAccuracy(IBeatmap beatmap, Dictionary<HitResult, int> statistics)
    {
        statistics.TryGetValue(HitResult.Great, out int countGreat);
        statistics.TryGetValue(HitResult.Ok, out int countGood);
        statistics.TryGetValue(HitResult.Meh, out int countMeh);
        statistics.TryGetValue(HitResult.Miss, out int countMiss);

        double total = 6 * countGreat + 2 * countGood + countMeh;
        double max = 6 * (countGreat + countGood + countMeh + countMiss);

        if (statistics.TryGetValue(HitResult.SliderTailHit, out int countSliderTailHit))
        {
            int countSliders = beatmap.HitObjects.Count(x => x is Slider);
            total += 3 * countSliderTailHit;
            max += 3 * countSliders;
        }

        if (statistics.TryGetValue(HitResult.LargeTickMiss, out int countLargeTicksMiss))
        {
            int countLargeTicks = beatmap.HitObjects.Sum(obj => obj.NestedHitObjects.Count(x => x is SliderTick || x is SliderRepeat));
            int countLargeTickHit = countLargeTicks - countLargeTicksMiss;

            total += 0.6 * countLargeTickHit;
            max += 0.6 * countLargeTicks;
        }

        return max == 0 ? 1 : total / max;
    }

    private double GetTaikoAccuracy(Dictionary<HitResult, int> statistics)
    {
        statistics.TryGetValue(HitResult.Great, out int countGreat);
        statistics.TryGetValue(HitResult.Ok, out int countGood);
        statistics.TryGetValue(HitResult.Miss, out int countMiss);
        
        int total = countGreat + countGood + countMiss;
        return total == 0 ? 1 : (double)((2 * countGreat) + countGood) / (2 * total);
    }

    private double GetCatchAccuracy(Dictionary<HitResult, int> statistics)
    {
        statistics.TryGetValue(HitResult.Great, out int great);
        statistics.TryGetValue(HitResult.LargeTickHit, out int largeTick);
        statistics.TryGetValue(HitResult.SmallTickHit, out int smallTick);
        statistics.TryGetValue(HitResult.Miss, out int miss);
        statistics.TryGetValue(HitResult.SmallTickMiss, out int smallMiss);

        double hits = great + largeTick + smallTick;
        double total = hits + miss + smallMiss;

        return total == 0 ? 1 : hits / total;
    }

    private double GetManiaAccuracy(Dictionary<HitResult, int> statistics, Mod[] mods)
    {
        statistics.TryGetValue(HitResult.Perfect, out int countPerfect);
        statistics.TryGetValue(HitResult.Great, out int countGreat);
        statistics.TryGetValue(HitResult.Good, out int countGood);
        statistics.TryGetValue(HitResult.Ok, out int countOk);
        statistics.TryGetValue(HitResult.Meh, out int countMeh);
        statistics.TryGetValue(HitResult.Miss, out int countMiss);

        int perfectWeight = mods.Any(m => m.Acronym == "CL") ? 300 : 305;

        double total = (perfectWeight * countPerfect) + (300 * countGreat) + (200 * countGood) + (100 * countOk) + (50 * countMeh);
        double max = perfectWeight * (countPerfect + countGreat + countGood + countOk + countMeh + countMiss);

        return max == 0 ? 1 : total / max;
    }
}