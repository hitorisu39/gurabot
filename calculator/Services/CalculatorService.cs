using Grpc.Core;
using Calculator.Protos;
using osu.Game.Rulesets;
using osu.Game.Rulesets.Osu;
using osu.Game.Rulesets.Taiko;
using osu.Game.Rulesets.Catch;
using osu.Game.Rulesets.Mania;
using osu.Game.Rulesets.Mods;
using osu.Framework.Bindables;
using osu.Game.Beatmaps;
using osu.Game.Rulesets.Difficulty;
using osu.Game.Rulesets.Scoring;
using System.Reflection;
using System.Globalization;
using osu.Game.Rulesets.Osu.Difficulty;
using osu.Game.Rulesets.Taiko.Difficulty;
using osu.Game.Rulesets.Catch.Difficulty;
using osu.Game.Rulesets.Mania.Difficulty;
using osu.Game.Rulesets.Difficulty.Preprocessing;
using osu.Game.Rulesets.Difficulty.Skills;
using System.Collections.Concurrent;

namespace Calculator.Services;

public class CalculatorService : Calculator.Protos.Calculator.CalculatorBase
{
    private readonly BeatmapCache _cache;
    private readonly HitResultGeneration _hitResultGeneration;

    private static readonly ConcurrentDictionary<Type, PropertyInfo[]> ObjectPropertiesCache = new();
    private static readonly ConcurrentDictionary<Type, Dictionary<string, PropertyInfo>> ModPropertiesCache = new();

    public CalculatorService(BeatmapCache cache, HitResultGeneration hitResultGeneration)
    {
        _cache = cache;
        _hitResultGeneration = hitResultGeneration;
    }

    private Ruleset GetRuleset(uint id) => id switch
    {
        0 => new OsuRuleset(),
        1 => new TaikoRuleset(),
        2 => new CatchRuleset(),
        3 => new ManiaRuleset(),
        _ => throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid ruleset ID"))
    };

    private Mod[] ParseMods(Ruleset ruleset, IEnumerable<ModMessage> modMessages, double? customClockRate)
    {
        var availableMods = ruleset.CreateAllMods().ToList();
        var result = new List<Mod>();

        foreach (var reqMod in modMessages)
        {
            var mod = availableMods.FirstOrDefault(m => m.Acronym == reqMod.Acronym);
            if (mod == null) continue;

            var modType = mod.GetType();
            var properties = ModPropertiesCache.GetOrAdd(modType, t => 
                t.GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase)
                 .ToDictionary(p => p.Name.Replace("_", ""), StringComparer.OrdinalIgnoreCase));

            foreach (var setting in reqMod.Settings)
            {
                var normalized = setting.Key.Replace("_", "");
                if (properties.TryGetValue(normalized, out var prop))
                {
                    if (prop.GetValue(mod) is IParseable parseableBindable)
                    {
                        parseableBindable.Parse(setting.Value, CultureInfo.InvariantCulture);
                    }
                }
            }

            result.Add(mod);
        }

        if (customClockRate.HasValue)
        {
            var existingRateMod = result.OfType<ModRateAdjust>().FirstOrDefault();

            if (existingRateMod != null)
            {
                existingRateMod.SpeedChange.Value = customClockRate.Value;
            }
            else if (Math.Abs(customClockRate.Value - 1.0) > 0.000001)
            {
                var targetAcronym = customClockRate.Value > 1.0 ? "DT" : "HT";
                var rateMod = availableMods
                    .FirstOrDefault(mod => mod.Acronym == targetAcronym) as ModRateAdjust;

                if (rateMod != null)
                {
                    rateMod.SpeedChange.Value = customClockRate.Value;
                    result.Add(rateMod);
                }
            }
        }

        return result.ToArray();
    }

    private Dictionary<string, double> ExtractAttributes(object obj)
    {
        var dict = new Dictionary<string, double>();
        var properties = ObjectPropertiesCache.GetOrAdd(obj.GetType(), t => t.GetProperties(BindingFlags.Public | BindingFlags.Instance));

        foreach (var prop in properties)
        {
            var name = char.ToLowerInvariant(prop.Name[0]) + prop.Name[1..];
            
            if (prop.PropertyType == typeof(double)) 
                dict[name] = (double)prop.GetValue(obj)!;
            else if (prop.PropertyType == typeof(int)) 
                dict[name] = (int)prop.GetValue(obj)!;
        }
        return dict;
    }

    private IEnumerable<SkillStrain> GetStrains(
        DifficultyCalculator calculator,
        IBeatmap playableBeatmap,
        Mod[] mods)
    {
        Type calculatorType = calculator.GetType();

        MethodInfo createSkillsMethod = FindInstanceMethod(
            calculatorType,
            "CreateSkills",
            typeof(IBeatmap),
            typeof(Mod[])
        ) ?? throw new MissingMethodException(
            calculatorType.FullName,
            "CreateSkills(IBeatmap, Mod[])"
        );

        MethodInfo createHitObjectsMethod = FindInstanceMethod(
            calculatorType,
            "CreateDifficultyHitObjects",
            typeof(IBeatmap),
            typeof(Mod[])
        ) ?? throw new MissingMethodException(
            calculatorType.FullName,
            "CreateDifficultyHitObjects(IBeatmap, Mod[])"
        );

        MethodInfo sortObjectsMethod = FindInstanceMethod(
            calculatorType,
            "SortObjects",
            typeof(IEnumerable<DifficultyHitObject>)
        ) ?? throw new MissingMethodException(
            calculatorType.FullName,
            "SortObjects(IEnumerable<DifficultyHitObject>)"
        );

        var skills = createSkillsMethod.Invoke(
            calculator,
            new object[] { playableBeatmap, mods }
        ) as Skill[];

        if (skills == null)
        {
            throw new InvalidOperationException(
                $"{calculatorType.Name}.CreateSkills() returned an unexpected value."
            );
        }

        var unsortedHitObjects = createHitObjectsMethod.Invoke(
            calculator,
            new object[] { playableBeatmap, mods }
        ) as IEnumerable<DifficultyHitObject>;

        if (unsortedHitObjects == null)
        {
            throw new InvalidOperationException(
                $"{calculatorType.Name}.CreateDifficultyHitObjects() returned an unexpected value."
            );
        }

        var hitObjects = sortObjectsMethod.Invoke(
            calculator,
            new object[] { unsortedHitObjects }
        ) as IEnumerable<DifficultyHitObject>;

        if (hitObjects == null)
        {
            throw new InvalidOperationException(
                $"{calculatorType.Name}.SortObjects() returned an unexpected value."
            );
        }

        foreach (DifficultyHitObject hitObject in hitObjects)
        {
            foreach (Skill skill in skills)
            {
                skill.Process(hitObject);
            }
        }

        var strains = new List<SkillStrain>(skills.Length);
        var nameCounts = new Dictionary<string, int>();

        foreach (Skill skill in skills)
        {
            IReadOnlyList<double> values = skill.GetObjectDifficulties();

            if (values.Count == 0)
                continue;

            string name = GetSkillName(skill);

            if (nameCounts.TryGetValue(name, out int duplicateCount))
            {
                duplicateCount++;
                nameCounts[name] = duplicateCount;
                name += duplicateCount;
            }
            else
            {
                nameCounts[name] = 1;
            }

            var strain = new SkillStrain
            {
                SkillName = name
            };

            strain.Peaks.AddRange(values);
            strains.Add(strain);
        }

        return strains;
    }

    private static MethodInfo? FindInstanceMethod(
        Type type,
        string methodName,
        params Type[] parameterTypes)
    {
        for (Type? current = type; current != null; current = current.BaseType)
        {
            MethodInfo? method = current.GetMethod(
                methodName,
                BindingFlags.Instance |
                BindingFlags.Public |
                BindingFlags.NonPublic |
                BindingFlags.DeclaredOnly,
                binder: null,
                types: parameterTypes,
                modifiers: null
            );

            if (method != null)
                return method;
        }

        return null;
    }

    private string GetSkillName(object skill)
    {
        var name = skill.GetType().Name;
        
        var withSlidersField = skill.GetType().GetField("IncludeSliders", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
        if (withSlidersField != null && withSlidersField.GetValue(skill) is false)
        {
            name += "NoSliders";
        }
        
        return name;
    }

    private BeatmapAttributes CalculateAdjustedAttributes(IBeatmap beatmap, double clockRate)
    {
        var baseDifficulty = beatmap.Difficulty;
        double preempt = IBeatmapDifficultyInfo.DifficultyRange(baseDifficulty.ApproachRate, 1800, 1200, 450);
        
        double adjustedPreempt = preempt / clockRate;
        float adjustedAr = (float)IBeatmapDifficultyInfo.InverseDifficultyRange(adjustedPreempt, 1800, 1200, 450);
        double hitWindowGreat = IBeatmapDifficultyInfo.DifficultyRange(baseDifficulty.OverallDifficulty, 80, 50, 20);
        double adjustedWindow = hitWindowGreat / clockRate;
        float adjustedOd = (float)IBeatmapDifficultyInfo.InverseDifficultyRange(adjustedWindow, 80, 50, 20);

        return new BeatmapAttributes
        {
            Ar = adjustedAr,
            Od = adjustedOd,
            Cs = baseDifficulty.CircleSize,
            Hp = baseDifficulty.DrainRate,
            ClockRate = clockRate
        };
    }

    private double CalculateClockRate(IEnumerable<Mod> mods)
    {
        double rate = 1.0;
        foreach (var mod in mods.OfType<IApplicableToRate>())
        {
            rate = mod.ApplyToRate(0, rate);
        }
        return rate;
    }

    public override Task<DifficultyResponse> CalculateDifficulty(DifficultyRequest request, ServerCallContext context)
    {
        var ruleset = GetRuleset(request.RulesetId);
        var mods = ParseMods(ruleset, request.Mods, request.HasClockRate ? request.ClockRate : null);

        IWorkingBeatmap beatmap = _cache.GetBeatmap(request.BeatmapPath);
        if (request.HasPassedObjects)
            beatmap = new TruncatedWorkingBeatmap(beatmap.Beatmap, (int)request.PassedObjects);

        var difficultyCalculator = ruleset.CreateDifficultyCalculator(beatmap);
        var difficultyAttributes = difficultyCalculator.Calculate(mods);

        var playableBeatmap = beatmap.GetPlayableBeatmap(ruleset.RulesetInfo, mods);
        var clockRate = CalculateClockRate(mods);

        var response = new DifficultyResponse
        {
            Beatmap = CalculateAdjustedAttributes(playableBeatmap, clockRate)
        };

        response.Attributes.Add(ExtractAttributes(difficultyAttributes));

        if (request.CalculateStrains)
        {
            var strains = GetStrains(difficultyCalculator, playableBeatmap, mods);
            response.Strains.AddRange(strains);
        }

        return Task.FromResult(response);
    }

    public override Task<PerformanceResponse> CalculatePerformance(PerformanceRequest request, ServerCallContext context)
    {
        var ruleset = GetRuleset(request.RulesetId);
        var mods = ParseMods(ruleset, request.Mods, request.HasClockRate ? request.ClockRate : null);

        DifficultyAttributes difficultyAttributes;
        IWorkingBeatmap beatmap = _cache.GetBeatmap(request.BeatmapPath);

        var playableBeatmap = beatmap.GetPlayableBeatmap(ruleset.RulesetInfo, mods);
        var clockRate = CalculateClockRate(mods);

        if (request.PrecalculatedDifficulty.Count > 0)
        {
            difficultyAttributes = request.RulesetId switch
            {
                0 => new OsuDifficultyAttributes(),
                1 => new TaikoDifficultyAttributes(),
                2 => new CatchDifficultyAttributes(),
                3 => new ManiaDifficultyAttributes(),
                _ => throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid ruleset ID"))
            };

            difficultyAttributes.Mods = mods;

            var properties = ObjectPropertiesCache.GetOrAdd(difficultyAttributes.GetType(), 
                t => t.GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase));

            foreach (var kvp in request.PrecalculatedDifficulty)
            {
                var prop = properties.FirstOrDefault(p =>
                    string.Equals(p.Name, kvp.Key, StringComparison.OrdinalIgnoreCase));

                if (prop != null && prop.CanWrite)
                {
                    prop.SetValue(
                        difficultyAttributes,
                        Convert.ChangeType(kvp.Value, prop.PropertyType, CultureInfo.InvariantCulture)
                    );
                }
            }
        }
        else
        {
            var difficultyBeatmap = request.HasPassedObjects 
                ? new TruncatedWorkingBeatmap(beatmap.Beatmap, (int)request.PassedObjects) 
                : beatmap;

            var difficultyCalculator = ruleset.CreateDifficultyCalculator(difficultyBeatmap);
            difficultyAttributes = difficultyCalculator.Calculate(mods);
        }

        var statistics = _hitResultGeneration.Generate(request.RulesetId, playableBeatmap, mods, request.Score);
        double accuracy = _hitResultGeneration.GetAccuracyForRuleset(request.RulesetId, playableBeatmap, statistics, mods);

        var scoreInfo = new osu.Game.Scoring.ScoreInfo
        {
            Ruleset = ruleset.RulesetInfo,
            Mods = mods,
            MaxCombo = request.Score.HasMaxCombo ? (int)request.Score.MaxCombo : difficultyAttributes.MaxCombo,
            Statistics = statistics,
            Accuracy = accuracy,
            BeatmapInfo = playableBeatmap.BeatmapInfo,
            TotalScore = request.TotalScore,
            LegacyTotalScore = request.LegacyTotalScore
        };

        var performanceCalculator = ruleset.CreatePerformanceCalculator();
        if (performanceCalculator == null)
        {
            throw new RpcException(new Status(StatusCode.Unimplemented, "Performance calculation is not supported for this ruleset."));
        }

        var performanceAttributes = performanceCalculator.Calculate(scoreInfo, difficultyAttributes);
        var response = new PerformanceResponse
        {
            HitResults = new HitResultResponse
            {
                MaxCombo = (uint)scoreInfo.MaxCombo,
                Accuracy = accuracy,
                Count300 = (uint)statistics.GetValueOrDefault(HitResult.Great, 0),
                Count100 = request.RulesetId == 2
                    ? (uint)statistics.GetValueOrDefault(HitResult.LargeTickHit, 0)
                    : (uint)statistics.GetValueOrDefault(HitResult.Ok, 0),
                Count50 = request.RulesetId == 2
                    ? (uint)statistics.GetValueOrDefault(HitResult.SmallTickHit, 0)
                    : (uint)statistics.GetValueOrDefault(HitResult.Meh, 0),
                CountMiss = (uint)statistics.GetValueOrDefault(HitResult.Miss, 0),
                CountGeki = (uint)statistics.GetValueOrDefault(HitResult.Perfect, 0),
                CountKatu = request.RulesetId == 2
                    ? (uint)statistics.GetValueOrDefault(HitResult.SmallTickMiss, 0)
                    : (uint)statistics.GetValueOrDefault(HitResult.Good, 0),
                CountLargeTickHits = (uint)statistics.GetValueOrDefault(HitResult.LargeTickHit, 0),
                CountSliderTailHits = (uint)statistics.GetValueOrDefault(HitResult.SliderTailHit, 0)
            },
            Difficulty = new DifficultyResponse
            {
                Beatmap = CalculateAdjustedAttributes(playableBeatmap, clockRate) 
            }
        };

        response.Difficulty.Attributes.Add(ExtractAttributes(difficultyAttributes));
        response.Attributes.Add(ExtractAttributes(performanceAttributes));

        return Task.FromResult(response);
    }

    public override async Task CalculatePerformanceStream(
        IAsyncStreamReader<PerformanceRequest> requestStream, 
        IServerStreamWriter<PerformanceResponse> responseStream, 
        ServerCallContext context)
    {
        using var writeLock = new SemaphoreSlim(1, 1);
        var tasks = new List<Task>();

        await foreach (var request in requestStream.ReadAllAsync())
        {
            var task = Task.Run(async () => 
            {
                try 
                {
                    var response = await CalculatePerformance(request, context);
                    
                    if (request.HasReferenceId) 
                    {
                        response.ReferenceId = request.ReferenceId;
                    }

                    await writeLock.WaitAsync();
                    try 
                    {
                        await responseStream.WriteAsync(response);
                    }
                    finally 
                    {
                        writeLock.Release();
                    }
                }
                catch (Exception ex) 
                { 
                    throw new RpcException(new Status(StatusCode.Unknown, ex.Message));
                }
            });

            tasks.Add(task);
        }

        await Task.WhenAll(tasks);
    }
}