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

    private Dictionary<HitResult, int> GenerateStandard(IBeatmap beatmap, Mod[] mods, double accuracy, int countMiss, int? countMeh, int? countGood, int? countLargeTickMisses, int? countSliderTailMisses)
    {
        int countGreat;
        int totalResultCount = beatmap.HitObjects.Count;

        if (countMeh != null || countGood != null)
        {
            countGreat = totalResultCount - (countGood ?? 0) - (countMeh ?? 0) - countMiss;
        }
        else
        {
            int relevantResultCount = totalResultCount - countMiss;
            double relevantAccuracy = relevantResultCount == 0 ? 0 : accuracy * totalResultCount / relevantResultCount;
            relevantAccuracy = Math.Clamp(relevantAccuracy, 0, 1);

            if (relevantAccuracy >= 0.25)
            {
                double ratio50To100 = Math.Pow(1 - (relevantAccuracy - 0.25) / 0.75, 2);
                double count100Estimate = 6 * relevantResultCount * (1 - relevantAccuracy) / (5 * ratio50To100 + 4);
                double count50Estimate = count100Estimate * ratio50To100;

                countGood = (int?)Math.Round(count100Estimate);
                countMeh = (int?)(Math.Round(count100Estimate + count50Estimate) - countGood);
            }
            else if (relevantAccuracy >= 1.0 / 6)
            {
                double count100Estimate = 6 * relevantResultCount * relevantAccuracy - relevantResultCount;
                double count50Estimate = relevantResultCount - count100Estimate;

                countGood = (int?)Math.Round(count100Estimate);
                countMeh = (int?)(Math.Round(count100Estimate + count50Estimate) - countGood);
            }
            else
            {
                double count50Estimate = 6 * relevantResultCount * relevantAccuracy;
                countGood = 0;
                countMeh = (int?)Math.Round(count50Estimate);
                countMiss = (int)(totalResultCount - (countMeh ?? 0));
            }

            countGreat = (int)(totalResultCount - (countGood ?? 0) - (countMeh ?? 0) - countMiss);
        }

        var result = new Dictionary<HitResult, int>
        {
            { HitResult.Great, countGreat },
            { HitResult.Ok, countGood ?? 0 },
            { HitResult.Meh, countMeh ?? 0 },
            { HitResult.Miss, countMiss },
        };

        bool isClassic = mods.Any(mod => mod.Acronym == "CL");

        if (!isClassic)
        {
            int totalLargeTicks = beatmap.HitObjects.Sum(
                hitObject => hitObject.NestedHitObjects.Count(
                    nested => nested is SliderTick || nested is SliderRepeat
                )
            );

            int largeTickMisses = Math.Clamp(
                countLargeTickMisses ?? 0,
                0,
                totalLargeTicks
            );

            result[HitResult.LargeTickHit] =
                totalLargeTicks - largeTickMisses;

            result[HitResult.LargeTickMiss] =
                largeTickMisses;

            int totalSliderEnds =
                beatmap.HitObjects.Count(hitObject => hitObject is Slider);

            int sliderTailMisses = Math.Clamp(
                countSliderTailMisses ?? 0,
                0,
                totalSliderEnds
            );

            result[HitResult.SliderTailHit] =
                totalSliderEnds - sliderTailMisses;
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

    private Dictionary<HitResult, int> GenerateMania(IBeatmap beatmap, Mod[] mods, double accuracy, int countMiss, int? countMeh, int? countOk, int? countGood, int? countGreat)
    {
        int totalHits = beatmap.HitObjects.Count;
        
        bool isClassic = mods.Any(m => m.Acronym == "CL");
        
        if (!isClassic)
            totalHits += beatmap.HitObjects.Count(ho => ho is HoldNote);

        if (countMeh != null || countOk != null || countGood != null || countGreat != null)
        {
            int countPerfect = totalHits - (countMiss + (countMeh ?? 0) + (countOk ?? 0) + (countGood ?? 0) + (countGreat ?? 0));

            return new Dictionary<HitResult, int>
            {
                [HitResult.Perfect] = countPerfect,
                [HitResult.Great] = countGreat ?? 0,
                [HitResult.Good] = countGood ?? 0,
                [HitResult.Ok] = countOk ?? 0,
                [HitResult.Meh] = countMeh ?? 0,
                [HitResult.Miss] = countMiss
            };
        }

        int perfectValue = isClassic ? 60 : 61;
        int targetTotal = (int)Math.Round(accuracy * totalHits * perfectValue);

        int remainingHits = totalHits - countMiss;
        int delta = Math.Max(targetTotal - (10 * remainingHits), 0);

        int perfects = Math.Min(delta / (perfectValue - 10), remainingHits);
        delta -= perfects * (perfectValue - 10);
        remainingHits -= perfects;

        int greats = Math.Min(delta / 50, remainingHits);
        delta -= greats * 50;
        remainingHits -= greats;

        countGood = Math.Min(delta / 30, remainingHits);
        delta -= countGood.Value * 30;
        remainingHits -= countGood.Value;

        int oks = Math.Min(delta / 10, remainingHits);
        remainingHits -= oks;

        countMeh = remainingHits;

        return new Dictionary<HitResult, int>
        {
            { HitResult.Perfect, perfects },
            { HitResult.Great, greats },
            { HitResult.Ok, oks },
            { HitResult.Good, countGood.Value },
            { HitResult.Meh, countMeh.Value },
            { HitResult.Miss, countMiss }
        };
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